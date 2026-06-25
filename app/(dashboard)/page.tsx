import Link from 'next/link';
import { Plus, FileText, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { canViewAllSales, getVisibleContractsFilter } from '@/lib/permissions';
import { requiresDiscountApproval } from '@/lib/contracts';
import { formatCurrency } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { formatStatus, statusBadgeClassName } from '@/lib/status-display';
import {
  contractMatchesDashboardFilter,
  isStaffDashboardPersona,
  parseDashboardFilter,
  type DashboardFilterKey,
} from '@/lib/dashboard-filters';
import {
  dashboardExcludedAccountEmails,
  filterAuditForDashboard,
  filterContractsForDashboard,
} from '@/lib/dashboard-exclusions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardHero } from '@/components/dashboard/hero';
import { DashboardLiveRefresh } from '@/components/dashboard/dashboard-live-refresh';
import { PipelineLive } from '@/components/dashboard/pipeline-live';
import { DashboardStatCard } from '@/components/dashboard/stat-card';
import { EventVitalSignsSection } from '@/components/dashboard/event-vital-signs';
import { SalesLeaderboard } from '@/components/dashboard/sales-leaderboard';
import { PersonalSalesSummary } from '@/components/dashboard/personal-sales-summary';
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed';
import { SuggestedActions } from '@/components/dashboard/suggested-actions';
import { buildGreetingSubtitle, buildSmartMetrics, greetingHour, greetingWord } from '@/lib/dashboard-greeting';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { BrandMixBreakdown } from '@/components/dashboard/brand-mix-breakdown';
import { StartDealPanel } from '@/components/dashboard/start-deal-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/contracts/status-badge';
import { fetchBoothBrandsByContractIds } from '@/lib/contract-booth-brand-queries';
import { getBrandMix, getDeadlines, getEventVitalSigns, getPipelineData, getRecentActivity, getSalesLeaderboard } from '@/lib/event-metrics';
import type { AuditLogEntry, ContractWithTotals, Event } from '@/types/db';
import {
  PRODUCT_WHISKYFEST,
  scopeContractsByProduct,
  scopeEventsByProduct,
  type ProductKey,
} from '@/lib/product-portal';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

const DASH_SCOPE_LIMIT = 2500;

async function getSupportedRepNames(email: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from('rep_assistants')
    .select('rep_id')
    .eq('assistant_email', email.toLowerCase());
  const ids = [...new Set((rows ?? []).map((r) => (r as { rep_id: string }).rep_id).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data: reps } = await supabase.from('sales_reps').select('name').in('id', ids).order('name');
  return (reps ?? []).map((r) => (r as { name: string }).name).filter(Boolean);
}

export async function getDashboardData(
  actor: Awaited<ReturnType<typeof requireContractActorForPage>>,
  productKey: ProductKey = PRODUCT_WHISKYFEST,
) {
  const supabase = getSupabaseAdmin();

  let contractsQuery = supabase
    .from('contracts_with_totals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(DASH_SCOPE_LIMIT);

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
    contractsQuery = contractsQuery.in('sales_rep_id', visibility.salesRepIds);
  } else if (visibility.filter === 'own') {
    contractsQuery = contractsQuery.limit(0);
  }

  const [contractsRes, eventsRes, supportedRepNames] = await Promise.all([
    contractsQuery,
    supabase.from('events').select('*').eq('is_active', true),
    getSupportedRepNames(actor.email),
  ]);
  const contractsRaw = (contractsRes.data ?? []) as ContractWithTotals[];
  const contractIds = contractsRaw.map((c) => c.id);
  const boothBrandRows =
    contractIds.length > 0 ? await fetchBoothBrandsByContractIds(supabase, contractIds) : [];
  let auditQuery = supabase.from('audit_log').select('*').order('occurred_at', { ascending: false }).limit(200);
  if (visibility.filter === 'own') {
    if (contractIds.length === 0) {
      auditQuery = supabase.from('audit_log').select('*').eq('id', -1);
    } else {
      auditQuery = auditQuery.in('contract_id', contractIds);
    }
  }
  const { data: auditRows } = await auditQuery;

  const allEvents = (eventsRes.data ?? []) as Event[];
  const excludedAccountEmails = dashboardExcludedAccountEmails();
  const contractsAll = filterContractsForDashboard(contractsRaw, excludedAccountEmails);
  const events = scopeEventsByProduct(allEvents, productKey);
  const contracts = scopeContractsByProduct(contractsAll, allEvents, productKey);
  const scopedContractIds = new Set(contracts.map((c) => c.id));
  const boothBrandMixRows = boothBrandRows.filter((row) =>
    scopedContractIds.has((row as { contract_id: string }).contract_id),
  );

  return {
    contracts,
    boothBrandMixRows,
    events,
    audit: filterAuditForDashboard((auditRows ?? []) as AuditLogEntry[], excludedAccountEmails).filter(
      (entry) => !entry.contract_id || scopedContractIds.has(entry.contract_id),
    ),
    actor,
    supportedRepNames,
    canViewAllSales: canViewAllSales({
      role: actor.role,
      is_events_team: actor.isEventsTeam,
      is_accounting: Boolean((appUser as { is_accounting?: boolean } | null)?.is_accounting),
      can_view_all_sales: Boolean((appUser as { can_view_all_sales?: boolean } | null)?.can_view_all_sales),
    }),
  };
}

function pillTone(filter: DashboardFilterKey, active: boolean): string {
  if (filter === 'all') {
    return active
      ? 'border-fest-700 bg-fest-50 text-fest-950 ring-1 ring-fest-600/30'
      : 'border-border bg-background text-foreground hover:bg-muted/50';
  }
  const map: Partial<Record<DashboardFilterKey, string>> = {
    draft: statusBadgeClassName('draft'),
    events_review: statusBadgeClassName('pending_events_review'),
    approved: statusBadgeClassName('approved'),
    sent: statusBadgeClassName('sent'),
    exhibitor_signed: statusBadgeClassName('partially_signed'),
    fully_signed: statusBadgeClassName('signed'),
    executed: statusBadgeClassName('executed'),
    cancelled: statusBadgeClassName('cancelled'),
  };
  const base = map[filter] ?? 'border-border bg-muted/40 text-foreground';
  return active ? `${base} ring-1 ring-fest-600/40 ring-offset-1` : `${base} opacity-95 hover:opacity-100`;
}

function filterBannerLabel(
  filter: DashboardFilterKey,
  pillDefs: { key: DashboardFilterKey; label: string }[],
): string {
  switch (filter) {
    case 'staff_needs_approval':
      return 'Needs Your Approval';
    case 'staff_countersign':
      return 'Awaiting Countersignature';
    case 'staff_ready_release':
      return 'Ready to Release';
    case 'rep_attention':
      return 'Needs Your Attention';
    case 'rep_events':
      return 'Awaiting Events Approval';
    case 'rep_ready_send':
      return 'Ready to Send';
    default:
      return pillDefs.find((p) => p.key === filter)?.label ?? filter;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  const actor = await requireContractActorForPage();
  const {
    contracts: allScoped,
    boothBrandMixRows,
    events,
    audit,
    supportedRepNames,
    canViewAllSales: hasGlobalVisibility,
  } = await getDashboardData(actor);

  const rawFilter =
    typeof searchParams?.filter === 'string' ? searchParams.filter : undefined;
  let filter = parseDashboardFilter(rawFilter);
  const staffPersonaEarly = isStaffDashboardPersona(actor.isAdmin, actor.isEventsTeam);
  if (staffPersonaEarly && rawFilter?.startsWith('rep_')) filter = 'all';
  if (!staffPersonaEarly && rawFilter?.startsWith('staff_')) filter = 'all';

  const scopeIds = actor.accessibleSalesRepIds;
  const visibleContracts = allScoped
    .filter((c) => contractMatchesDashboardFilter(c, filter, scopeIds))
    .slice(0, 50);

  const activeScoped = allScoped.filter(
    (c) => c.status !== 'cancelled' && c.status !== 'voided',
  );
  const contractsCount = activeScoped.length;
  const staffPersona = staffPersonaEarly;

  const totalExecutedCents = activeScoped
    .filter((c) => c.status === 'executed')
    .reduce((a, c) => a + c.grand_total_cents, 0);
  const totalInFlightCents = activeScoped
    .filter((c) =>
      [
        'ready_for_review',
        'approved',
        'sent',
        'partially_signed',
        'signed',
        'pending_events_review',
        'imported',
      ].includes(c.status),
    )
    .reduce((a, c) => a + c.grand_total_cents, 0);
  const totalPipelineCents = totalExecutedCents + totalInFlightCents;
  const draftCount = activeScoped.filter((c) => c.status === 'draft' || c.status === 'ready_for_review').length;
  const executedCount = activeScoped.filter((c) => c.status === 'executed').length;

  const eventMap = new Map(events.map((e) => [e.id, e]));
  const vitalSigns = getEventVitalSigns(activeScoped, events);
  const pipelineData = getPipelineData(activeScoped);
  const leaderboard = getSalesLeaderboard(activeScoped);
  const recentActivity = getRecentActivity(audit, activeScoped);
  const deadlines = getDeadlines(activeScoped);
  const brandMix = getBrandMix(activeScoped, boothBrandMixRows);

  const pillDefs: { key: DashboardFilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: formatStatus('draft') },
    { key: 'events_review', label: formatStatus('pending_events_review') },
    { key: 'approved', label: formatStatus('approved') },
    { key: 'sent', label: formatStatus('sent') },
    { key: 'exhibitor_signed', label: formatStatus('partially_signed') },
    { key: 'fully_signed', label: formatStatus('signed') },
    { key: 'executed', label: formatStatus('executed') },
    { key: 'cancelled', label: formatStatus('cancelled') },
  ];

  const pillCounts = (k: DashboardFilterKey) =>
    allScoped.filter((c) => contractMatchesDashboardFilter(c, k, scopeIds)).length;

  const staffNeedsApprovalCount = allScoped.filter(
    (c) => requiresDiscountApproval(c) || c.status === 'pending_events_review' || c.status === 'imported',
  ).length;
  const staffCountersignCount = allScoped.filter((c) => c.status === 'partially_signed').length;
  const staffReadyReleaseCount = allScoped.filter((c) => c.status === 'signed').length;

  const repAttentionCount = allScoped.filter((c) =>
    contractMatchesDashboardFilter(c, 'rep_attention', scopeIds),
  ).length;
  const repEventsCount = allScoped.filter((c) =>
    contractMatchesDashboardFilter(c, 'rep_events', scopeIds),
  ).length;
  const repReadySendCount = allScoped.filter((c) =>
    contractMatchesDashboardFilter(c, 'rep_ready_send', scopeIds),
  ).length;

  const completionLabel = `${executedCount} of ${contractsCount} contracts executed · ${formatCurrency(totalExecutedCents)} of ${formatCurrency(totalPipelineCents)} executed value`;

  const tz = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE ?? 'America/New_York';
  const hour = greetingHour(tz);
  const word = greetingWord(hour);
  const first =
    session?.user?.name?.trim()?.split(/\s+/).filter(Boolean)[0] ??
    session?.user?.email?.split('@')[0] ??
    'there';
  const greetingHeadline = `${word}, ${first}`;
  const smartMetrics = buildSmartMetrics(allScoped, actor.salesRepId, requiresDiscountApproval);
  const primaryEvent = events.find((e) => e.is_active) ?? events[0];
  const wfDate = primaryEvent?.event_date ? new Date(`${primaryEvent.event_date}T12:00:00`) : new Date('2026-11-20T12:00:00');
  const daysToEvent = Math.max(0, Math.ceil((wfDate.getTime() - Date.now()) / 86400000));
  const greetingSubtitle = buildGreetingSubtitle(actor.role, actor.isEventsTeam, actor.isAdmin, smartMetrics, daysToEvent);

  const filterDescription = (() => {
    if (filter === 'all') return 'Most recent 50 active contracts (cancelled/voided hidden; use Cancelled filter)';
    if (filter.startsWith('staff_') || filter.startsWith('rep_')) {
      return `Filtered by priority · ${visibleContracts.length} of ${allScoped.length} match`;
    }
    return `Filtered by ${pillDefs.find((p) => p.key === filter)?.label ?? filter} · ${visibleContracts.length} of ${allScoped.length} match`;
  })();

  return (
    <div className="space-y-10">
      <DashboardLiveRefresh />
      <DashboardHero
        contractsCount={contractsCount}
        eventsCount={events.length}
        supportedRepNames={supportedRepNames}
        completionLabel={completionLabel}
        greetingHeadline={greetingHeadline}
        greetingSubtitle={greetingSubtitle}
      />

      <StartDealPanel readOnly={Boolean(session?.is_read_only_impersonation)} />

      <SuggestedActions
        contracts={allScoped}
        viewer={{
          role: actor.role,
          is_events_team: actor.isEventsTeam,
          is_admin: actor.isAdmin,
          sales_rep_id: actor.salesRepId,
        }}
      />

      <EventVitalSignsSection metrics={vitalSigns} canViewAllSales={hasGlobalVisibility} />

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-medium text-foreground">
          {hasGlobalVisibility ? 'Pipeline' : 'My Pipeline'}
        </h2>
        <Card className="bg-card">
          <CardContent className="p-6">
            <PipelineLive data={pipelineData} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {hasGlobalVisibility ? (
          <SalesLeaderboard reps={leaderboard} />
        ) : (
          <PersonalSalesSummary
            contractsSigned={vitalSigns.signedContracts}
            totalValueCents={vitalSigns.contractedRevenueCents}
          />
        )}
        <RecentActivityFeed activities={recentActivity} title={hasGlobalVisibility ? 'Recent Activity' : 'My Activity'} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <UpcomingDeadlines deadlines={deadlines} />
        <BrandMixBreakdown categories={brandMix} title={hasGlobalVisibility ? 'Brand Mix' : 'Brands in Your Pipeline'} />
      </section>

      {/* Priority */}
      {filter !== 'all' && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-fest-200 bg-fest-50 px-4 py-3 dark:border-fest-700 dark:bg-fest-900/20">
          <div className="text-sm">
            <span className="font-medium text-fest-900 dark:text-fest-100">Filtered:</span>{' '}
            <span className="text-ink-700 dark:text-parchment-200">
              {filterBannerLabel(filter, pillDefs)} · {visibleContracts.length} of {allScoped.length} contracts
            </span>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-fest-700 underline-offset-2 hover:underline dark:text-fest-300"
          >
            Clear filter
          </Link>
        </div>
      )}
      {staffPersona ? (
        <div className="grid gap-4 md:grid-cols-3">
          <PriorityCard
            href="/?filter=staff_needs_approval#recent-contracts"
            active={filter === 'staff_needs_approval'}
            title="Needs Your Approval"
            description="Discount approval pending or events review queue"
            count={staffNeedsApprovalCount}
          />
          <PriorityCard
            href="/?filter=staff_countersign#recent-contracts"
            active={filter === 'staff_countersign'}
            title="Awaiting Countersignature"
            description={formatStatus('partially_signed')}
            count={staffCountersignCount}
          />
          <PriorityCard
            href="/?filter=staff_ready_release#recent-contracts"
            active={filter === 'staff_ready_release'}
            title="Ready to Release"
            description={`${formatStatus('signed')} — not yet released`}
            count={staffReadyReleaseCount}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <PriorityCard
            href="/?filter=rep_attention#recent-contracts"
            active={filter === 'rep_attention'}
            title="Needs Your Attention"
            description="Sent back for changes or error state"
            count={repAttentionCount}
          />
          <PriorityCard
            href="/?filter=rep_events#recent-contracts"
            active={filter === 'rep_events'}
            title="Awaiting Events Approval"
            description={formatStatus('pending_events_review')}
            count={repEventsCount}
          />
          <PriorityCard
            href="/?filter=rep_ready_send#recent-contracts"
            active={filter === 'rep_ready_send'}
            title="Ready to Send"
            description={`${formatStatus('approved')} — awaiting DocuSign`}
            count={repReadySendCount}
          />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="dashboard-stats">
        <DashboardStatCard
          icon={CheckCircle2}
          label="Executed"
          value={formatCurrency(totalExecutedCents)}
          sub={`${executedCount} contracts`}
          accent="emerald"
        />
        <DashboardStatCard
          icon={Clock}
          label="In Flight"
          value={formatCurrency(totalInFlightCents)}
          sub="Sent + Approved + Under Review"
          accent="amber"
        />
        <DashboardStatCard icon={FileText} label="Drafts" value={String(draftCount)} sub="Awaiting review" accent="whisky" />
        <DashboardStatCard
          icon={DollarSign}
          label="Total Pipeline"
          value={formatCurrency(totalPipelineCents)}
          sub="All active contract value"
          accent="fest"
        />
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {pillDefs.map((p) => (
          <Link
            key={p.key}
            href={p.key === 'all' ? '/' : `/?filter=${p.key}#recent-contracts`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm ${pillTone(p.key, filter === p.key)}`}
          >
            <span>{p.label}</span>
            <span className="font-mono tabular-nums">{pillCounts(p.key)}</span>
          </Link>
        ))}
      </div>

      {/* Contracts table */}
      <Card
        id="recent-contracts"
        className="overflow-hidden border-fest-600/15"
        data-tour="dashboard-contracts-table"
      >
        <div className="flex items-center justify-between border-b border-fest-600/10 px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold">Recent Contracts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{filterDescription}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contracts">View all →</Link>
          </Button>
        </div>
        <CardContent className="p-0">
          {visibleContracts.length === 0 ? (
            <EmptyState
              hasContracts={allScoped.length > 0}
              activeFilter={filter !== 'all' ? filter : undefined}
              activeFilterLabel={pillDefs.find((p) => p.key === filter)?.label}
              totalContracts={allScoped.length}
            />
          ) : (
            <>
              <div className="divide-y divide-border/50 md:hidden">
                {visibleContracts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contracts/${c.id}`}
                    className="block px-4 py-4 first:pt-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{c.exhibitor_company_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{eventMap.get(c.event_id)?.name ?? '—'}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={c.status} dataTour="status-badge" />
                      <RelativeTime iso={c.updated_at} className="text-xs text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="hidden md:block">
                <Table className="[&_tbody_tr:hover]:bg-muted/40">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exhibitor</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleContracts.map((c) => (
                      <TableRow key={c.id} className="group">
                        <TableCell>
                          <Link href={`/contracts/${c.id}`} className="block hover:text-accent-brand">
                            <div className="font-medium">{c.exhibitor_company_name}</div>
                            {c.brands_poured && (
                              <div className="mt-0.5 text-xs text-muted-foreground">{c.brands_poured}</div>
                            )}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {eventMap.get(c.event_id)?.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} dataTour="status-badge" />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatCurrency(c.grand_total_cents)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <RelativeTime iso={c.updated_at} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/contracts/${c.id}`}
                            className="text-accent-brand opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            →
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PriorityCard({
  href,
  active,
  title,
  description,
  count,
}: {
  href: string;
  active: boolean;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <Link href={href}>
      <Card
        className={`h-full border-fest-600/15 transition-all hover:-translate-y-0.5 hover:shadow-md ${
          active ? 'ring-2 ring-fest-600/35' : ''
        }`}
      >
        <CardContent className="space-y-2 p-5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-base font-semibold leading-snug">{title}</h3>
            <span className="font-mono text-2xl font-semibold tabular-nums text-fest-800">{count}</span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({
  hasContracts,
  activeFilter,
  activeFilterLabel,
  totalContracts,
}: {
  hasContracts: boolean;
  activeFilter?: string;
  activeFilterLabel?: string;
  totalContracts: number;
}) {
  if (activeFilter) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fest-100 text-fest-800">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="font-serif text-lg font-semibold">
          No contracts match the {activeFilterLabel ?? activeFilter} filter.
        </h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Showing 0 of {totalContracts} total contracts.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link href="/">Clear filter</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-fest-100 text-fest-800">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="font-serif text-lg font-semibold">{hasContracts ? 'No matching contracts' : 'No contracts yet'}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasContracts
          ? 'Try another filter or clear filters from the status pills above.'
          : "Once you create your first contract, it'll show up here with its full status history."}
      </p>
      {!hasContracts && (
        <Button className="mt-6" asChild>
          <Link href="/contracts/new">
            <Plus className="h-4 w-4" /> Create your first contract
          </Link>
        </Button>
      )}
    </div>
  );
}
