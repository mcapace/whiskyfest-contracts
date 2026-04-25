import { getSupabaseAdmin } from '@/lib/supabase';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { getVisibleContractsFilter } from '@/lib/permissions';
import { ContractsList } from '@/components/contracts/contracts-list';
import type { ContractWithTotals, ContractStatus, Event } from '@/types/db';

export const dynamic = 'force-dynamic';

const VALID: Set<string> = new Set([
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'signed',
  'executed',
  'cancelled',
  'error',
]);

async function loadContracts(
  actor: Awaited<ReturnType<typeof requireContractActorForPage>>,
  searchParams: { status?: string; q?: string },
) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('contracts_with_totals').select('*').order('created_at', { ascending: false }).limit(200);

  const { data: appUser } = await supabase
    .from('app_users')
    .select('is_accounting, can_view_all_sales')
    .eq('email', actor.email)
    .maybeSingle();
  const visibility = getVisibleContractsFilter({
    role: actor.role,
    is_events_team: actor.isEventsTeam,
    is_accounting: Boolean((appUser as { is_accounting?: boolean } | null)?.is_accounting),
    can_view_all_sales: Boolean((appUser as { can_view_all_sales?: boolean } | null)?.can_view_all_sales),
    accessibleSalesRepIds: actor.accessibleSalesRepIds,
  });
  if (visibility.filter === 'own' && visibility.salesRepIds.length > 0) {
    query = query.in('sales_rep_id', visibility.salesRepIds);
  } else if (visibility.filter === 'own') {
    query = query.limit(0);
  }

  const status = searchParams.status;
  if (status && status !== 'all') {
    if (status === 'draft') {
      query = query.or('status.eq.draft,status.eq.ready_for_review');
    } else if (VALID.has(status)) {
      query = query.eq('status', status as ContractStatus);
    }
  }

  const q = searchParams.q?.trim();
  if (q) {
    query = query.ilike('exhibitor_company_name', `%${q}%`);
  }

  const [{ data: contracts }, { data: events }] = await Promise.all([
    query,
    supabase.from('events').select('*'),
  ]);

  return {
    contracts: (contracts ?? []) as ContractWithTotals[],
    events: (events ?? []) as Event[],
  };
}

export default async function ContractsListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireContractActorForPage();
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;

  const { contracts, events } = await loadContracts(actor, { status, q });

  return (
    <ContractsList contracts={contracts} events={events} currentRepId={actor.salesRepId} />
  );
}
