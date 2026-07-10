import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import {
  contractReopenToDraftPatch,
  voidContractEnvelopeIfPresent,
} from '@/lib/reopen-contract-to-draft';
import type { Contract, ContractWithTotals } from '@/types/db';

export const runtime = 'nodejs';

/** Admin or events team: return a cancelled contract to draft for edits and a new DocuSign send. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', params.id).single<Contract>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (contract.status !== 'cancelled') {
    return NextResponse.json(
      { error: 'Only cancelled contracts can be redrafted. Use Recall for in-flight DocuSign envelopes.' },
      { status: 409 },
    );
  }

  await voidContractEnvelopeIfPresent(
    contract.docusign_envelope_id,
    'Cancelled contract redrafted for resend',
  );

  const { error } = await supabase
    .from('contracts')
    .update(contractReopenToDraftPatch('cancelled'))
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: gate.actor.email,
    action: 'cancelled_contract_redrafted',
    from_status: 'cancelled',
    to_status: 'draft',
    metadata: {
      previous_envelope_id: contract.docusign_envelope_id,
      previous_cancelled_reason: contract.cancelled_reason,
    },
  });

  const { data: withTotals } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<ContractWithTotals>();

  if (withTotals) {
    try {
      await syncExhibitorRosterWriteback(withTotals, { statusLabel: 'Draft' });
    } catch (err) {
      console.error('[exhibitor-roster] redraft writeback failed', err);
    }
  }

  revalidateContractPaths(params.id);

  return NextResponse.json({ ok: true });
}
