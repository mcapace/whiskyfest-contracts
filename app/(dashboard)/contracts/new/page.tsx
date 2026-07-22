import { getSupabaseAdmin } from '@/lib/supabase';
import { NewContractForm } from '@/components/contracts/new-contract-form';
import type { ContractWithTotals, Event } from '@/types/db';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { getVisibleContractsFilter } from '@/lib/permissions';
import { recentCompanyNames } from '@/lib/new-contract-hints';
import { parseDealKindParam } from '@/lib/contract-deal-kind';
import { PRODUCT_WHISKYFEST, scopeEventsByProduct } from '@/lib/product-portal';
import { actorCanUseNoChargeBooth, getStephenSenatoreRepId, noChargeMustAssignStephenRep } from '@/lib/no-charge-booth';
import {
  brandsTextToBoothBrandDrafts,
  canAccessParticipationReport,
} from '@/lib/participation-report-shared';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: { deal?: string; fromPipeline?: string };
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

  let pipelineTargetId: string | null = null;
  let initialValues: Partial<{
    event_id: string;
    exhibitor_legal_name: string;
    exhibitor_company_name: string;
    booth_count: number;
    booth_rate_cents: number;
    sales_rep_id: string;
    notes: string;
  }> | undefined;
  let initialBoothBrands:
    | { booth_index: number; brand_name: string; brand_category?: string | null; expressions: string[] }[]
    | undefined;
  let pipelineBanner: string | null = null;

  const fromPipeline = searchParams.fromPipeline?.trim();
  if (fromPipeline) {
    if (!canAccessParticipationReport(actor.email)) {
      redirect('/contracts/new');
    }
    const { data: target } = await supabase
      .from('wf_pipeline_targets')
      .select('*')
      .eq('id', fromPipeline)
      .eq('is_active', true)
      .maybeSingle();

    if (target?.linked_contract_id) {
      redirect(`/contracts/${target.linked_contract_id}`);
    }

    if (target) {
      pipelineTargetId = target.id;
      const booths = Math.max(1, Number(target.booth_count) || 1);
      const rate =
        Number(target.rate_per_booth_cents) > 0
          ? Number(target.rate_per_booth_cents)
          : (scopedEvents[0]?.booth_rate_cents ?? 1_500_000);
      const noteParts = [
        target.section === 'pending_renewal' ? 'Converted from pending renewal' : 'Converted from new business inquiry',
        target.notes?.trim() || null,
      ].filter(Boolean);
      initialValues = {
        event_id: target.event_id,
        exhibitor_legal_name: target.company_name,
        exhibitor_company_name: target.company_name,
        booth_count: booths,
        booth_rate_cents: rate,
        sales_rep_id: target.sales_rep_id ?? '',
        notes: noteParts.join('\n\n'),
      };
      initialBoothBrands = brandsTextToBoothBrandDrafts(target.brands_text, booths);
      pipelineBanner =
        target.section === 'pending_renewal'
          ? `Converting pending renewal: ${target.company_name}`
          : `Converting new business inquiry: ${target.company_name}`;
    }
  }

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
      initialValues={initialValues}
      initialBoothBrands={initialBoothBrands}
      pipelineTargetId={pipelineTargetId}
      pipelineBanner={pipelineBanner}
    />
  );
}
