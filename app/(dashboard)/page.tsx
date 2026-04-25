import Link from 'next/link';
import { Plus, FileText, DollarSign, Clock, CheckCircle2 } from 'lucide-react';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { canViewAllSales, getVisibleContractsFilter } from '@/lib/permissions';
import { requiresDiscountApproval } from '@/lib/contracts';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { formatStatus, statusBadgeClassName } from '@/lib/status-display';
import {
  contractMatchesDashboardFilter,
  isStaffDashboardPersona,
  parseDashboardFilter,
  type DashboardFilterKey,
} from '@/lib/dashboard-filters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardHero } from '@/components/dashboard/hero';
import { DashboardStatCard } from '@/components/dashboard/stat-card';
import { EventVitalSignsSection } from '@/components/dashboard/event-vital-signs';
import { PipelineChart } from '@/components/dashboard/pipeline-chart';
import { SalesLeaderboard } from '@/components/dashboard/sales-leaderboard';
import { PersonalSalesSummary } from '@/components/dashboard/personal-sales-summary';
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { BrandMixBreakdown } from '@/components/dashboard/brand-mix-breakdown';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/contracts/status-badge';
import { getBrandMix, getDeadlines, getEventVitalSigns, getPipelineData, getRecentActivity, getSalesLeaderboard } from '@/lib/event-metrics';
import type { AuditLogEntry, ContractWithTotals, Event } from '@/types/db';

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

async function getDashboardData(actor: Awaited<ReturnType<typeof requireContractActorForPage>>) {
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
  const contracts = (contractsRes.data ?? []) as ContractWithTotals[];
  const contractIds = contracts.map((c) => c.id);
  let auditQuery = supabase.from('audit_log').select('*').order('occurred_at', { ascending: false }).limit(200);
  if (visibility.filter === 'own') {
    if (contractIds.length === 0) {
      auditQuery = supabase.from('audit_log').select('*').eq('id', -1);
    } else {
      auditQuery = auditQuery.in('contract_id', contractIds);
    }
  }
  const { data: auditRows } = await auditQuery;

  return {
    contracts,
    events: (eventsRes.data ?? []) as Event[],
    audit: (auditRows ?? []) as AuditLogEntry[],
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireContractActorForPage();
  const { contracts: allScoped, events, audit, supportedRepNames, canViewAllSales: hasGlobalVisibility } = await getDashboardData(actor);

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

  const contractsCount = allScoped.length;
  const staffPersona = staffPersonaEarly;

  const totalExecutedCents = allScoped
    .filter((c) => c.status === 'executed')
    .reduce((a, c) => a + c.grand_total_cents, 0);
  const totalInFlightCents = allScoped
    .filter((c) =>
      ['ready_for_review', 'approved', 'sent', 'partially_signed', 'signed', 'pending_events_review'].includes(
        c.status,
      ),
    )
    .reduce((a, c) => a + c.grand_total_cents, 0);
  const totalPipelineCents = totalExecutedCents + totalInFlightCents;
  const draftCount = allScoped.filter((c) => c.status === 'draft' || c.status === 'ready_for_review').length;
  const executedCount = allScoped.filter((c) => c.status === 'executed').length;
  const progressPct = totalPipelineCents > 0 ? Math.round((totalExecutedCents / totalPipelineCents) * 100) : 0;

  const eventMap = new Map(events.map((e) => [e.id, e]));
  const vitalSigns = getEventVitalSigns(allScoped, events);
  const pipelineData = getPipelineData(allScoped);
  const leaderboard = getSalesLeaderboard(allScoped);
  const recentActivity = getRecentActivity(audit, allScoped);
  const deadlines = getDeadlines(allScoped);
  const brandMix = getBrandMix(allScoped);

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
    (c) => requiresDiscountApproval(c) || c.status === 'pending_events_review',
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

  const filterDescription = (() => {
    if (filter === 'all') return 'Most recent 50 contracts matching your access';
    if (filter.startsWith('staff_') || filter.startsWith('rep_')) {
      return `Filtered by priority · showing up to 50 matches`;
    }
    return `Filtered by ${pillDefs.find((p) => p.key === filter)?.label ?? filter} · up to 50 shown`;
  })();

  return (
    <div className="space-y-10">
      <DashboardHero
        contractsCount={contractsCount}
        eventsCount={events.length}
        supportedRepNames={supportedRepNames}
        completionLabel={completionLabel}
        progressPct={progressPct}
      />

      <EventVitalSignsSection metrics={vitalSigns} canViewAllSales={hasGlobalVisibility} />

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-medium text-oak-800">
          {hasGlobalVisibility ? 'Pipeline' : 'My Pipeline'}
        </h2>
        <Card className="bg-parchment-50">
          <CardContent className="p-6">
            <PipelineChart data={pipelineData} />
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
      {staffPersona ? (
        <div className="grid gap-4 md:grid-cols-3">
          <PriorityCard
            href="/?filter=staff_needs_approval"
            active={filter === 'staff_needs_approval'}
            title="Needs Your Approval"
            description="Discount approval pending or events review queue"
            count={staffNeedsApprovalCount}
          />
          <PriorityCard
            href="/?filter=staff_countersign"
            active={filter === 'staff_countersign'}
            title="Awaiting Countersignature"
            description={formatStatus('partially_signed')}
            count={staffCountersignCount}
          />
          <PriorityCard
            href="/?filter=staff_ready_release"
            active={filter === 'staff_ready_release'}
            title="Ready to Release"
            description={`${formatStatus('signed')} — not yet released`}
            count={staffReadyReleaseCount}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <PriorityCard
            href="/?filter=rep_attention"
            active={filter === 'rep_attention'}
            title="Needs Your Attention"
            description="Sent back for changes or error state"
            count={repAttentionCount}
          />
          <PriorityCard
            href="/?filter=rep_events"
            active={filter === 'rep_events'}
            title="Awaiting Events Approval"
            description={formatStatus('pending_events_review')}
            count={repEventsCount}
          />
          <PriorityCard
            href="/?filter=rep_ready_send"
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
            href={p.key === 'all' ? '/' : `/?filter=${p.key}`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm ${pillTone(p.key, filter === p.key)}`}
          >
            <span>{p.label}</span>
            <span className="font-mono tabular-nums">{pillCounts(p.key)}</span>
          </Link>
        ))}
      </div>

      {/* Contracts table */}
      <Card className="overflow-hidden border-fest-600/15" data-tour="dashboard-contracts-table">
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
            <EmptyState hasContracts={allScoped.length > 0} />
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
                      <span className="text-xs text-muted-foreground">{formatRelative(c.updated_at)}</span>
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
                          {formatRelative(c.updated_at)}
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

function EmptyState({ hasContracts }: { hasContracts: boolean }) {
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
