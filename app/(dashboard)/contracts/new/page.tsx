import { getSupabaseAdmin } from '@/lib/supabase';
import { NewContractForm } from '@/components/contracts/new-contract-form';
import type { ContractWithTotals, Event } from '@/types/db';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { getVisibleContractsFilter } from '@/lib/permissions';
import { recentCompanyNames } from '@/lib/new-contract-hints';
import { parseDealKindParam } from '@/lib/contract-deal-kind';
import { PRODUCT_WHISKYFEST, scopeEventsByProduct } from '@/lib/product-portal';
import { actorCanUseNoChargeBooth, getStephenSenatoreRepId, noChargeMustAssignStephenRep } from '@/lib/no-charge-booth';

export const dynamic = 'force-dynamic';

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: { deal?: string };
}) {
  const actor = await requireContractActorForPage();
  const supabase = getSupabaseAdmin();

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

  let hintsQuery = supabase
    .from('contracts_with_totals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(120);

  if (visibility.filter === 'own' && visibility.salesRepIds.length > 0) {
    hintsQuery = hintsQuery.in('sales_rep_id', visibility.salesRepIds);
  } else if (visibility.filter === 'own') {
    hintsQuery = hintsQuery.limit(0);
  }

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .order('event_date', { ascending: true });

  const scopedEvents = scopeEventsByProduct((events ?? []) as Event[], PRODUCT_WHISKYFEST);
  const wfEventIds = scopedEvents.map((e) => e.id);
  if (wfEventIds.length === 0) {
    hintsQuery = hintsQuery.limit(0);
  } else {
    hintsQuery = hintsQuery.in('event_id', wfEventIds);
  }

  const { data: hintRows } = await hintsQuery;

  const wfHints = (hintRows ?? []) as ContractWithTotals[];
  const signedOrExecuted = wfHints.filter((c) => c.status === 'signed' || c.status === 'executed');
  const smartHints = {
    recentCompanies: recentCompanyNames(wfHints),
    priorContracts: signedOrExecuted,
  };

  const initialDealKind = parseDealKindParam(searchParams.deal) ?? undefined;

  const [canUseNoChargeBooth, stephenRepId, noChargeEnforceStephenRep] = await Promise.all([
    actorCanUseNoChargeBooth(actor.email),
    getStephenSenatoreRepId(),
    noChargeMustAssignStephenRep(actor.email),
  ]);

  return (
    <NewContractForm
      events={scopedEvents}
      currentUserEmail={actor.email}
      isAdmin={actor.isAdmin}
      smartHints={smartHints}
      initialDealKind={initialDealKind}
      canUseNoChargeBooth={canUseNoChargeBooth}
      noChargeEnforceStephenRep={noChargeEnforceStephenRep}
      stephenRepId={stephenRepId}
    />
  );
}
