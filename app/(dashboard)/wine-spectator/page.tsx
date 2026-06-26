import Link from 'next/link';
import { auth } from '@/lib/auth';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { formatCurrency } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { greetingHour, greetingWord } from '@/lib/dashboard-greeting';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import { getDashboardData } from '@/app/(dashboard)/page';
import { WineSpectatorHero } from '@/components/dashboard/wine-spectator-hero';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isEventsManagedWorkflow } from '@/lib/contract-template-profile';
import { wineSpectatorContractIsAdmin } from '@/lib/wine-spectator-access';
import { NyweSusannahDashboard } from '@/components/wine-spectator/nywe-susannah-dashboard';
import { NyweMetricsGrid } from '@/components/wine-spectator/nywe-metrics-grid';
import { NywePipelinePanel } from '@/components/wine-spectator/nywe-pipeline-panel';
import { NyweQuickNav } from '@/components/wine-spectator/nywe-quick-nav';
import { buildNyweDashboardMetrics, getNywePipelineData } from '@/lib/nywe-dashboard-metrics';
import { runNyweBackgroundDocuSignSync } from '@/lib/nywe-background-docusign-sync';
import { DashboardLiveRefresh } from '@/components/dashboard/dashboard-live-refresh';
import { NyweDocuSignRefreshButton } from '@/components/wine-spectator/nywe-docusign-refresh-button';
import type { ContractWithTotals } from '@/types/db';

export const dynamic = 'force-dynamic';

function countByStatus(contracts: ContractWithTotals[], statuses: string[]): number {
  return contracts.filter((c) => statuses.includes(c.status)).length;
}

const RECENT_SENT_DAYS = 14;

export default async function WineSpectatorDashboardPage() {
  const session = await auth();
  const actor = await requireContractActorForPage();
  await runNyweBackgroundDocuSignSync();
  const { contracts: allScoped, events } = await getDashboardData(actor, PRODUCT_WINE_SPECTATOR);

  const activeScoped = allScoped.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');
  const primaryEvent = events.find((e) => e.is_active) ?? events[0] ?? null;
  const reviewCount = countByStatus(activeScoped, ['pending_events_review']);
  const waitingOnWineryCount = countByStatus(activeScoped, ['sent']);
  const readyToCountersign = activeScoped
    .filter((c) => c.status === 'partially_signed')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const totalValueCents = activeScoped.reduce((sum, c) => sum + c.grand_total_cents, 0);
  const metrics = buildNyweDashboardMetrics(activeScoped, primaryEvent);
  const pipeline = getNywePipelineData(activeScoped);

  const stuckForAccounting = activeScoped
    .filter((c) => c.status === 'signed')
    .sort((a, b) => (b.signed_at ?? b.updated_at).localeCompare(a.signed_at ?? a.updated_at));

  const cutoff = Date.now() - RECENT_SENT_DAYS * 24 * 60 * 60 * 1000;
  const recentlySent = activeScoped
    .filter((c) => c.status === 'executed' && c.executed_at && Date.parse(c.executed_at) >= cutoff)
    .sort((a, b) => (b.executed_at ?? '').localeCompare(a.executed_at ?? ''))
    .slice(0, 8);

  const recent = [...activeScoped]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 10);

  const eventsManaged = primaryEvent ? isEventsManagedWorkflow(primaryEvent) : false;
  const canFixStuck =
    wineSpectatorContractIsAdmin(PRODUCT_WINE_SPECTATOR, {
      isAdmin: actor.isAdmin,
      isWineSpectatorAdmin: actor.isWineSpectatorAdmin,
    }) ||
    (actor.isEventsTeam && eventsManaged);

  const tz = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE ?? 'America/New_York';
  const hour = greetingHour(tz);
  const word = greetingWord(hour);
  const first =
    session?.user?.name?.trim()?.split(/\s+/).filter(Boolean)[0] ??
    session?.user?.email?.split('@')[0] ??
    'there';

  const sendBlocked = primaryEvent?.client_send_enabled === false;

  return (
    <div className="space-y-10">
      <DashboardLiveRefresh />

      <WineSpectatorHero
        event={primaryEvent}
        contractsCount={metrics.totalLicenses}
        completionLabel={`${formatCurrency(totalValueCents)} total pipeline · ${metrics.completionPct}% executed`}
        greetingHeadline={`${word}, ${first}`}
        greetingSubtitle={primaryEvent?.name ?? 'New York Wine Experience'}
      />

      {sendBlocked ? (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/95 px-5 py-4 text-amber-950">
          <p className="text-sm font-semibold">DocuSign send is turned off for now</p>
          <p className="mt-1 text-sm opacity-90">You can still review contracts here. Mike can turn on sending when you&apos;re ready.</p>
        </div>
      ) : null}

      <NyweMetricsGrid metrics={metrics} />

      <div className="flex justify-end">
        <NyweDocuSignRefreshButton />
      </div>

      <NyweQuickNav />

      <NywePipelinePanel data={pipeline} />

      <NyweSusannahDashboard
          stuck={stuckForAccounting.map((c) => ({
            id: c.id,
            exhibitorCompanyName: c.exhibitor_company_name,
            grandTotalCents: c.grand_total_cents,
          }))}
          recentlySent={recentlySent.map((c) => ({
            id: c.id,
            exhibitorCompanyName: c.exhibitor_company_name,
            grandTotalCents: c.grand_total_cents,
            executedAt: c.executed_at,
          }))}
          reviewCount={reviewCount}
          waitingOnWineryCount={waitingOnWineryCount}
          readyToCountersign={readyToCountersign.map((c) => ({
            id: c.id,
            exhibitorCompanyName: c.exhibitor_company_name,
            grandTotalCents: c.grand_total_cents,
            updatedAt: c.updated_at,
          }))}
          canFixStuck={canFixStuck}
        />

      <Card className="overflow-hidden border-fest-600/15" data-tour="dashboard-contracts-table">
        <div className="flex items-center justify-between border-b border-fest-600/10 px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold">Recent contracts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Latest updates across all exhibitor contracts</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/wine-spectator/contracts">View all →</Link>
          </Button>
        </div>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No contracts yet — start from the exhibitor roster.</p>
          ) : (
            <>
              <div className="divide-y divide-border/50 md:hidden">
                {recent.map((c) => (
                  <Link
                    key={c.id}
                    href={`/wine-spectator/contracts/${c.id}`}
                    className="block px-4 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-medium leading-snug">{c.exhibitor_company_name}</p>
                      <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={c.status} />
                      <RelativeTime iso={c.updated_at} className="text-xs text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
              <div className="hidden md:block">
                <Table className="[&_tbody_tr:hover]:bg-muted/40">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Winery</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">License fee</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((c) => (
                      <TableRow key={c.id} className="group">
                        <TableCell>
                          <Link href={`/wine-spectator/contracts/${c.id}`} className="block font-medium hover:text-accent-brand">
                            {c.exhibitor_company_name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{formatCurrency(c.grand_total_cents)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <RelativeTime iso={c.updated_at} />
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
