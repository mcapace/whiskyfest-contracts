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
import { NyweSusannahDashboard } from '@/components/wine-spectator/nywe-susannah-dashboard';
import { NyweMetricsGrid } from '@/components/wine-spectator/nywe-metrics-grid';
import { NywePipelinePanel } from '@/components/wine-spectator/nywe-pipeline-panel';
import { NyweHomeSearch } from '@/components/wine-spectator/nywe-home-search';
import { NyweQuickNav } from '@/components/wine-spectator/nywe-quick-nav';
import { NyweBoothQrRowDownload } from '@/components/wine-spectator/nywe-booth-qr-row-download';
import { buildNyweDashboardMetrics, getNywePipelineData } from '@/lib/nywe-dashboard-metrics';
import { scheduleNyweBackgroundDocuSignSync } from '@/lib/nywe-background-docusign-sync';
import { listNyweExecutedBoothQrContracts, refreshNyweQrClicks } from '@/lib/nywe-booth-qr';
import { DashboardLiveRefresh } from '@/components/dashboard/dashboard-live-refresh';
import type { ContractWithTotals } from '@/types/db';

export const dynamic = 'force-dynamic';

function countByStatus(contracts: ContractWithTotals[], statuses: string[]): number {
  return contracts.filter((c) => statuses.includes(c.status)).length;
}

const RECENT_SENT_DAYS = 14;

function queueItem(c: ContractWithTotals) {
  return {
    id: c.id,
    exhibitorCompanyName: c.exhibitor_company_name,
    legalName: c.exhibitor_legal_name,
    signerName: c.signer_1_name,
    grandTotalCents: c.grand_total_cents,
  };
}

export default async function WineSpectatorDashboardPage() {
  const session = await auth();
  const actor = await requireContractActorForPage();
  scheduleNyweBackgroundDocuSignSync();
  const { contracts: allScoped, events } = await getDashboardData(actor, PRODUCT_WINE_SPECTATOR);

  const activeScoped = allScoped.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');
  const primaryEvent = events.find((e) => e.is_active) ?? events[0] ?? null;
  const reviewCount = countByStatus(activeScoped, ['pending_events_review']);
  const waitingOnWineryCount = countByStatus(activeScoped, ['sent']);
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


  const tz = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE ?? 'America/New_York';
  const hour = greetingHour(tz);
  const word = greetingWord(hour);
  const first =
    session?.user?.name?.trim()?.split(/\s+/).filter(Boolean)[0] ??
    session?.user?.email?.split('@')[0] ??
    'there';

  const reviewQueue = activeScoped
    .filter((c) => c.status === 'pending_events_review')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const waitingQueue = activeScoped
    .filter((c) => c.status === 'sent')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  if (primaryEvent?.id) {
    await refreshNyweQrClicks(primaryEvent.id).catch((err) => {
      console.warn('[nywe] QR click refresh skipped', err instanceof Error ? err.message : err);
    });
  }

  const executedBoothQr = primaryEvent?.id
    ? await listNyweExecutedBoothQrContracts(primaryEvent.id)
    : [];
  const missingQrCount = executedBoothQr.filter((c) => !c.exhibitor_website_url?.trim()).length;

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
        compact
      />

      {sendBlocked ? (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/95 px-5 py-4 text-amber-950">
          <p className="text-sm font-semibold">DocuSign send is turned off for now</p>
          <p className="mt-1 text-sm opacity-90">You can still review contracts here. Mike can turn on sending when you&apos;re ready.</p>
        </div>
      ) : null}

      <NyweHomeSearch
        contracts={activeScoped.map((c) => ({
          id: c.id,
          exhibitor_company_name: c.exhibitor_company_name,
          exhibitor_legal_name: c.exhibitor_legal_name,
          signer_1_name: c.signer_1_name,
          signer_1_email: c.signer_1_email,
          brands_poured: c.brands_poured,
          status: c.status,
          order_type: c.order_type,
        }))}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-medium text-foreground">Work from here</h2>
          <p className="nywe-subhead text-sm text-muted-foreground">Roster, licenses, and sponsorships</p>
        </div>
        <NyweQuickNav />
      </div>

      <NyweSusannahDashboard
          stuck={stuckForAccounting.map((c) => queueItem(c))}
          recentlySent={recentlySent
            .filter((c) => c.order_type !== 'sponsorship_only')
            .map((c) => ({
            ...queueItem(c),
            executedAt: c.executed_at,
          }))}
          reviewQueue={reviewQueue.map(queueItem)}
          waitingQueue={waitingQueue.map(queueItem)}
          reviewCount={reviewCount}
          waitingOnWineryCount={waitingOnWineryCount}
          missingQrCount={missingQrCount}
        />

      <NyweMetricsGrid metrics={metrics} compact />

      <NywePipelinePanel data={pipeline} />

      <Card className="overflow-hidden border-fest-600/15" data-tour="dashboard-contracts-table">
        <div className="flex items-center justify-between border-b border-fest-600/10 px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-semibold">Recent contracts</h2>
            <p className="mt-0.5 text-pretty text-xs leading-snug text-muted-foreground">
              Latest updates across exhibitor&nbsp;contracts
            </p>
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
                  <div key={c.id} className="px-4 py-4">
                    <Link href={`/wine-spectator/contracts/${c.id}`} className="block transition-colors hover:text-accent-brand">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium leading-snug">{c.exhibitor_company_name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {[c.exhibitor_legal_name, c.signer_1_name, c.order_type === 'sponsorship_only' ? 'Sponsorship' : 'Vendor license']
                              .filter((v) => v && v !== c.exhibitor_company_name)
                              .join(' · ')}
                          </p>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(c.grand_total_cents)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={c.status} />
                        <RelativeTime iso={c.updated_at} className="text-xs text-muted-foreground" />
                      </div>
                    </Link>
                    {c.status === 'executed' && c.order_type !== 'sponsorship_only' ? (
                      <div className="mt-3">
                        <NyweBoothQrRowDownload
                          contractId={c.id}
                          exhibitorName={c.exhibitor_company_name}
                          websiteUrl={c.exhibitor_website_url}
                          missingHref={`/wine-spectator/contracts/${c.id}`}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="hidden md:block">
                <Table className="[&_tbody_tr:hover]:bg-muted/40">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Winery</TableHead>
                      <TableHead>Signer</TableHead>
                      <TableHead>Deal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">QR</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
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
                          {c.exhibitor_legal_name && c.exhibitor_legal_name !== c.exhibitor_company_name ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.exhibitor_legal_name}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.signer_1_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">
                          {c.order_type === 'sponsorship_only' ? 'Sponsorship' : 'Vendor license'}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status === 'executed' && c.order_type !== 'sponsorship_only' ? (
                            <NyweBoothQrRowDownload
                              contractId={c.id}
                              exhibitorName={c.exhibitor_company_name}
                              websiteUrl={c.exhibitor_website_url}
                              missingHref={`/wine-spectator/contracts/${c.id}`}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
