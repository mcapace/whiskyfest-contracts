import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { voidEnvelope } from '@/lib/docusign';
import { voidContractEnvelopeIfPresent } from '@/lib/reopen-contract-to-draft';
import { notifyAccountingExecutedContractVoided, notifyContractVoided } from '@/lib/notifications';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { syncBilledContractToGoogleSheet } from '@/lib/sheets-billed-export';
import type { Contract, ContractWithTotals, Event, InvoiceStatus } from '@/types/db';

const schema = z.object({
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(100, 'Reason must be 100 characters or less'),
});

export const runtime = 'nodejs';

const VOIDABLE_STATUSES = new Set(['sent', 'partially_signed', 'imported', 'executed']);

/** Admin/events: void DocuSign (when present) and mark contract voided — including executed deals for amount corrections. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.reason?.[0] ?? 'Invalid reason' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', params.id)
    .single<Contract>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  if (!VOIDABLE_STATUSES.has(contract.status)) {
    return NextResponse.json({ error: `Cannot void contract in status: ${contract.status}` }, { status: 403 });
  }

  const envelopeId = contract.docusign_envelope_id?.trim() ?? null;
  const wasExecuted = contract.status === 'executed';
  const reason = parsed.data.reason;

  if (contract.status === 'imported') {
    // No DocuSign envelope.
  } else if (wasExecuted) {
    // Completed envelopes often cannot be voided in DocuSign — continue either way.
    await voidContractEnvelopeIfPresent(envelopeId, reason);
  } else {
    if (!envelopeId) {
      return NextResponse.json({ error: 'No DocuSign envelope found for this contract.' }, { status: 409 });
    }
    try {
      await voidEnvelope(envelopeId, reason);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const nowIso = new Date().toISOString();
  const previousStatus = contract.status;
  const priorInvoice = (contract.invoice_status ?? 'pending') as InvoiceStatus;

  const accountingPatch: Record<string, unknown> = {};
  if (wasExecuted) {
    const shouldVoidInvoice =
      priorInvoice === 'invoice_sent' ||
      priorInvoice === 'paid' ||
      priorInvoice === 'pending' ||
      priorInvoice === 'invoice_voided';
    accountingPatch.accounting_notified_at = null;
    accountingPatch.invoice_sent_at = null;
    accountingPatch.invoice_sent_by = null;
    accountingPatch.paid_at = null;
    if (shouldVoidInvoice && priorInvoice !== 'not_invoiced') {
      accountingPatch.invoice_status = 'invoice_voided';
    }
    const stamp = `[${nowIso.slice(0, 10)}] Contract voided after execution by ${gate.actor.email}: ${reason}`;
    const priorNotes = contract.accounting_notes?.trim();
    accountingPatch.accounting_notes = priorNotes ? `${priorNotes}\n${stamp}` : stamp;
  }

  const { error: updErr } = await supabase
    .from('contracts')
    .update({
      status: 'voided',
      voided_at: nowIso,
      voided_by: gate.actor.email,
      voided_reason: reason,
      ...accountingPatch,
    })
    .eq('id', contract.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    contract_id: contract.id,
    actor_email: gate.actor.email,
    action: wasExecuted ? 'executed_contract_voided' : 'contract_voided',
    from_status: previousStatus,
    to_status: 'voided',
    metadata: {
      reason,
      envelope_id: envelopeId ?? undefined,
      previous_status: previousStatus,
      prior_invoice_status: wasExecuted ? priorInvoice : undefined,
      prior_accounting_notified_at: wasExecuted ? contract.accounting_notified_at : undefined,
    },
  });

  const [{ data: latest }, { data: event }] = await Promise.all([
    supabase.from('contracts_with_totals').select('*').eq('id', contract.id).maybeSingle<ContractWithTotals>(),
    supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle<Event>(),
  ]);

  if (latest) {
    try {
      await syncExhibitorRosterWriteback(latest, { trackerStatus: 'voided' });
    } catch (err) {
      console.error('Failed to update exhibitor roster sheet', err);
    }
  }

  if (wasExecuted) {
    void syncBilledContractToGoogleSheet(contract.id);
  }

  if (latest) {
    try {
      await notifyContractVoided({
        contract: latest,
        event: event ?? null,
        voidedBy: { email: gate.actor.email, name: gate.actor.appUser.name ?? null },
        reason,
        voidedAtIso: nowIso,
        wasExecuted,
      });
    } catch (err) {
      console.error('[notifyContractVoided]', err);
    }
  }

  if (wasExecuted && latest) {
    try {
      await notifyAccountingExecutedContractVoided({
        contract: latest,
        event: event ?? null,
        voidedBy: { email: gate.actor.email, name: gate.actor.appUser.name ?? null },
        reason,
        voidedAtIso: nowIso,
        priorInvoiceStatus: priorInvoice,
      });
    } catch (err) {
      console.error('[notifyAccountingExecutedContractVoided]', err);
    }
  }

  revalidateContractPaths(contract.id);
  return NextResponse.json({ ok: true, wasExecuted });
}
