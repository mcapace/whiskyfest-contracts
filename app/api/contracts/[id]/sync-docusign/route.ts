import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { insertContractAudit } from '@/lib/audit-log';
import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/**
 * POST — Reconcile contract status with DocuSign when Connect webhooks were missed.
 * Admin or events team only.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();

  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', contract.event_id)
    .maybeSingle<Event>();

  const result = await syncContractFromDocuSign(supabase, contract, event ?? null, gate.actor.email, {
    forcePoll: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  if (result.changed) {
    await insertContractAudit(supabase, {
      contract_id: params.id,
      actor_email: gate.actor.email,
      action: 'docusign_synced',
      from_status: result.fromStatus as ContractWithTotals['status'],
      to_status: result.toStatus as ContractWithTotals['status'],
      metadata: { message: result.message },
    });
    revalidateContractPaths(params.id);
  }

  return NextResponse.json(result);
}
