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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isEventsManagedWorkflow } from '@/lib/contract-template-profile';
import { wineSpectatorContractIsAdmin } from '@/lib/wine-spectator-access';
import { NyweSusannahDashboard } from '@/components/wine-spectator/nywe-susannah-dashboard';
import { DashboardLiveRefresh } from '@/components/dashboard/dashboard-live-refresh';
import type { ContractWithTotals } from '@/types/db';

export const dynamic = 'force-dynamic';

function countByStatus(contracts: ContractWithTotals[], statuses: string[]): number {
  return contracts.filter((c) => statuses.includes(c.status)).length;
}

const RECENT_SENT_DAYS = 14;

export default async function WineSpectatorDashboardPage() {
  const session = await auth();
  const actor = await requireContractActorForPage();
  const { contracts: allScoped, events } = await getDashboardData(actor, PRODUCT_WINE_SPECTATOR);

  const activeScoped = allScoped.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');
  const primaryEvent = events.find((e) => e.is_active) ?? events[0] ?? null;
  const contractsCount = activeScoped.length;
  const reviewCount = countByStatus(activeScoped, ['pending_events_review']);
  const waitingOnWineryCount = countByStatus(activeScoped, ['sent', 'partially_signed']);
  const totalValueCents = activeScoped.reduce((sum, c) => sum + c.grand_total_cents, 0);

  const stuckForAccounting = activeScoped
    .filter((c) => c.status === 'signed')
    .sort((a, b) => (b.signed_at ?? b.updated_at).localeCompare(a.signed_at ?? a.updated_at));

  const cutoff = Date.now() - RECENT_SENT_DAYS * 24 * 60 * 60 * 1000;
  const recentlySent = activeScoped
    .filter((c) => c.status === 'executed' && c.executed_at && Date.parse(c.executed_at) >= cutoff)
    .sort((a, b) => (b.executed_at ?? '').localeCompare(a.executed_at ?? ''))
    .slice(0, 8);

  const recent = allScoped.slice(0, 8);

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
    <div className="space-y-8">
      <DashboardLiveRefresh />
      <WineSpectatorHero
        event={primaryEvent}
        contractsCount={contractsCount}
        completionLabel={`${formatCurrency(totalValueCents)} in vendor licenses`}
        greetingHeadline={`${word}, ${first}`}
      />

      {sendBlocked ? (
        <div className="rounded-xl border border-amber-300/80 bg-amber-50/95 p-5 text-amber-950">
          <p className="text-base font-semibold">DocuSign send is turned off for now</p>
          <p className="mt-1 text-sm">You can still review licenses here. Mike can turn on sending when you&apos;re ready.</p>
        </div>
      ) : null}

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
        canFixStuck={canFixStuck}
      />

      <section className="rounded-xl border border-border/60 bg-muted/20 p-6">
        <h2 className="text-xl font-semibold text-foreground">Exhibitor list</h2>
        <p className="mt-2 text-base text-muted-foreground">
          Your Google Sheet roster — see who still needs a license, and create one with a single click.
        </p>
        <Button asChild size="lg" className="mt-4 h-12 px-8 text-base">
          <Link href="/wine-spectator/roster">Open exhibitor list</Link>
        </Button>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Recent activity</h2>
          <Link href="/wine-spectator/contracts" className="text-sm font-medium text-accent-brand hover:underline">
            All licenses
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="p-6 text-base text-muted-foreground">No licenses yet — start from the exhibitor list.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Winery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/wine-spectator/contracts/${c.id}`} className="font-medium hover:text-accent-brand">
                          {c.exhibitor_company_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.grand_total_cents)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        <RelativeTime iso={c.updated_at} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
