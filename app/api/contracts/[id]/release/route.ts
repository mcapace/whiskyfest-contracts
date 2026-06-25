import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isEventsManagedWorkflow } from '@/lib/contract-template-profile';
import { requiresDiscountApproval } from '@/lib/contracts';
import { isLegacyImportedContract } from '@/lib/legacy-import';
import { releaseContractToAccounting } from '@/lib/release-to-accounting';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/** Release to accounting: fully signed (admin) or manually imported legacy PDF (admin or events team). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  if (requiresDiscountApproval(contract, event)) {
    return NextResponse.json(
      { error: 'Discount approval required before contract can be released.' },
      { status: 403 },
    );
  }

  const { actor } = gate;
  const eventsManagedRelease = actor.isEventsTeam && isEventsManagedWorkflow(event);

  if (contract.status === 'signed') {
    if (!actor.isAdmin && !eventsManagedRelease) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (isLegacyImportedContract(contract) && !contract.events_approved_at) {
      return NextResponse.json(
        { error: 'Events approval required before this legacy import can be released to accounting.' },
        { status: 403 },
      );
    }
  } else if (contract.status === 'imported') {
    return NextResponse.json(
      { error: 'Approve this legacy import before releasing to accounting.' },
      { status: 409 },
    );
  } else {
    return NextResponse.json(
      { error: 'Release to Accounting is only available for fully signed contracts.' },
      { status: 409 },
    );
  }

  const result = await releaseContractToAccounting({
    contract,
    event,
    actorEmail: actor.email,
    supabase,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
