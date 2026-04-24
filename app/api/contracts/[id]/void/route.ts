import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { voidEnvelope } from '@/lib/docusign';
import { notifyContractVoided } from '@/lib/notifications';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { updateContractRow } from '@/lib/sheets-tracker';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

const schema = z.object({
  reason: z.string().trim().min(5, 'Reason must be at least 5 characters').max(100, 'Reason must be 100 characters or less'),
});

export const runtime = 'nodejs';

/** Admin/events only: void an in-flight DocuSign envelope and mark contract as voided. */
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

  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json({ error: `Cannot void contract in status: ${contract.status}` }, { status: 403 });
  }

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return NextResponse.json({ error: 'No DocuSign envelope found for this contract.' }, { status: 409 });
  }

  try {
    await voidEnvelope(envelopeId, parsed.data.reason);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const nowIso = new Date().toISOString();
  const previousStatus = contract.status;

  const { error: updErr } = await supabase
    .from('contracts')
    .update({
      status: 'voided',
      voided_at: nowIso,
      voided_by: gate.actor.email,
      voided_reason: parsed.data.reason,
    })
    .eq('id', contract.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    contract_id: contract.id,
    actor_email: gate.actor.email,
    action: 'contract_voided',
    from_status: previousStatus,
    to_status: 'voided',
    metadata: { reason: parsed.data.reason, envelope_id: envelopeId, previous_status: previousStatus },
  });

  const [{ data: latest }, { data: event }] = await Promise.all([
    supabase.from('contracts_with_totals').select('*').eq('id', contract.id).maybeSingle<ContractWithTotals>(),
    supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle<Event>(),
  ]);

  if (latest) {
    try {
      await updateContractRow(latest, { trackerStatus: 'voided' });
    } catch (err) {
      console.error('Failed to update Sheets tracker', err);
    }
  }

  if (latest) {
    try {
      await notifyContractVoided({
        contract: latest,
        event: event ?? null,
        voidedBy: { email: gate.actor.email, name: gate.actor.appUser.name ?? null },
        reason: parsed.data.reason,
        voidedAtIso: nowIso,
      });
    } catch (err) {
      console.error('[notifyContractVoided]', err);
    }
  }

  revalidateContractPaths(contract.id);
  return NextResponse.json({ ok: true });
}
