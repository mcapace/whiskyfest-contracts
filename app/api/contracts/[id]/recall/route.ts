import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { clearedRepEnteredBilling } from '@/lib/contract-schemas';
import { voidEnvelope } from '@/lib/docusign';
import { notifySalesRepContractRecalled } from '@/lib/notifications';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

const schema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

/**
 * Admin or events team: void the in-flight DocuSign envelope and return the contract to **draft**
 * so pricing, booths, brands, and signer can be edited before a new send.
 */
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
      { error: 'Recall reason is required and must be at least 10 characters.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', params.id).single<Contract>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json(
      { error: 'Recall is only available while the DocuSign contract is sent or partially signed.' },
      { status: 409 },
    );
  }

  const oldEnvelopeId = contract.docusign_envelope_id?.trim();
  if (!oldEnvelopeId) {
    return NextResponse.json({ error: 'No DocuSign contract is linked to this record.' }, { status: 409 });
  }

  try {
    await voidEnvelope(oldEnvelopeId, `Recalled by sender for revisions — ${parsed.data.reason.slice(0, 800)}`);
  } catch (e: unknown) {
    console.error('DocuSign void failed during recall, continuing to reset contract state:', e);
  }

  const cleared = clearedRepEnteredBilling();

  const { error } = await supabase
    .from('contracts')
    .update({
      status: 'draft',
      docusign_envelope_id: null,
      sent_at: null,
      signed_at: null,
      countersigned_at: null,
      countersigned_by_email: null,
      countersigned_by_name: null,
      executed_at: null,
      billing_contact_name: null,
      billing_contact_email: null,
      event_contact_name: null,
      event_contact_email: null,
      exhibitor_fields_captured_at: null,
      ...cleared,
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: gate.actor.email,
    action: 'contract_recalled_to_draft',
    from_status: contract.status,
    to_status: 'draft',
    metadata: { old_envelope_id: oldEnvelopeId, reason: parsed.data.reason },
  });

  const [{ data: withTotals }, { data: event }] = await Promise.all([
    supabase.from('contracts_with_totals').select('*').eq('id', params.id).maybeSingle<ContractWithTotals>(),
    supabase.from('events').select('*').eq('id', contract.event_id).maybeSingle<Event>(),
  ]);

  if (withTotals) {
    try {
      await notifySalesRepContractRecalled({
        contract: withTotals,
        event: event ?? null,
        recalledBy: { email: gate.actor.email, name: gate.actor.appUser.name ?? null },
        reason: parsed.data.reason,
      });
    } catch (err) {
      console.error('[notifySalesRepContractRecalled]', err);
    }
  }

  revalidateContractPaths(params.id);

  return NextResponse.json({ ok: true });
}
