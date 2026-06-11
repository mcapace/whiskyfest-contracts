import Link from 'next/link';
import { auth } from '@/lib/auth';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { greetingHour, greetingWord } from '@/lib/dashboard-greeting';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import { getDashboardData } from '@/app/(dashboard)/page';
import { WineSpectatorHero } from '@/components/dashboard/wine-spectator-hero';
import { DashboardStatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Clock, CheckCircle2, Send } from 'lucide-react';
import type { ContractWithTotals } from '@/types/db';

export const dynamic = 'force-dynamic';

function countByStatus(contracts: ContractWithTotals[], statuses: string[]): number {
  return contracts.filter((c) => statuses.includes(c.status)).length;
}

export default async function WineSpectatorDashboardPage() {
  const session = await auth();
  const actor = await requireContractActorForPage();
  const { contracts: allScoped, events } = await getDashboardData(actor, PRODUCT_WINE_SPECTATOR);

  const activeScoped = allScoped.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');
  const primaryEvent = events.find((e) => e.is_active) ?? events[0] ?? null;
  const contractsCount = activeScoped.length;
  const draftCount = countByStatus(activeScoped, ['draft', 'ready_for_review']);
  const reviewCount = countByStatus(activeScoped, ['pending_events_review']);
  const approvedCount = countByStatus(activeScoped, ['approved']);
  const sentCount = countByStatus(activeScoped, ['sent', 'partially_signed']);
  const signedCount = countByStatus(activeScoped, ['signed', 'executed']);
  const totalValueCents = activeScoped.reduce((sum, c) => sum + c.grand_total_cents, 0);
  const recent = allScoped.slice(0, 12);

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
      <WineSpectatorHero
        event={primaryEvent}
        contractsCount={contractsCount}
        completionLabel={`${formatCurrency(totalValueCents)} total license value`}
        greetingHeadline={`${word}, ${first}`}
      />

      {sendBlocked ? (
        <div className="rounded-md border border-amber-300/80 bg-amber-50/95 p-4 text-amber-950">
          <p className="text-sm font-semibold">Client send is disabled</p>
          <p className="mt-1 text-sm">
            Prepare and approve vendor licenses internally. DocuSign send stays off until enabled in Events admin.
          </p>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/wine-spectator/contracts?status=draft" className="block">
          <DashboardStatCard label="Drafts" value={String(draftCount)} sub="In progress" icon={FileText} accent="whisky" />
        </Link>
        <Link href="/wine-spectator/contracts?status=pending_events_review" className="block">
          <DashboardStatCard label="Events review" value={String(reviewCount)} sub="Awaiting approval" icon={Clock} accent="amber" />
        </Link>
        <Link href="/wine-spectator/contracts?status=approved" className="block">
          <DashboardStatCard label="Approved" value={String(approvedCount)} sub="Ready when send enabled" icon={CheckCircle2} accent="fest" />
        </Link>
        <Link href="/wine-spectator/contracts?status=sent" className="block">
          <DashboardStatCard
            label="Sent / signed"
            value={String(sentCount + signedCount)}
            sub="With exhibitors"
            icon={Send}
            accent="emerald"
          />
        </Link>
      </section>

      <section className="rounded-lg border border-border/60 bg-muted/20 p-5">
        <h2 className="font-display text-xl font-medium text-foreground">Exhibitor roster</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sync from Google Sheets, create licenses on demand, and write signing status back to the sheet.
        </p>
        <Link href="/wine-spectator/roster" className="mt-3 inline-flex text-sm font-medium text-accent-brand hover:underline">
          Open exhibitor roster →
        </Link>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-medium text-foreground">Recent licenses</h2>
            <p className="mt-1 text-sm text-muted-foreground">Wine Spectator contracts only — not mixed with WhiskyFest.</p>
          </div>
          <Link href="/wine-spectator/contracts" className="text-sm font-medium text-accent-brand hover:underline">
            View all
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No vendor licenses yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exhibitor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
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
                      <TableCell className="text-right text-muted-foreground">{formatRelative(c.updated_at)}</TableCell>
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
