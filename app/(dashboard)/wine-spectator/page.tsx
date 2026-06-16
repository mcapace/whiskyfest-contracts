import Link from 'next/link';
import { auth } from '@/lib/auth';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { formatCurrency, formatRelative } from '@/lib/utils';
import { greetingHour, greetingWord } from '@/lib/dashboard-greeting';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import { getDashboardData } from '@/app/(dashboard)/page';
import { WineSpectatorDashboardHeader } from '@/components/dashboard/wine-spectator-dashboard-header';
import { DashboardStatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Clock, CheckCircle2, Send, ArrowRight } from 'lucide-react';
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
  const recent = allScoped.slice(0, 8);

  const tz = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE ?? 'America/New_York';
  const hour = greetingHour(tz);
  const word = greetingWord(hour);
  const first =
    session?.user?.name?.trim()?.split(/\s+/).filter(Boolean)[0] ??
    session?.user?.email?.split('@')[0] ??
    'there';

  const sendBlocked = primaryEvent?.client_send_enabled === false;

  return (
    <div className="space-y-6">
      <WineSpectatorDashboardHeader
        event={primaryEvent}
        contractsCount={contractsCount}
        totalValueCents={totalValueCents}
        greetingHeadline={`${word}, ${first}`}
        sendBlocked={sendBlocked}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/wine-spectator/contracts?status=draft" className="block">
          <DashboardStatCard label="Drafts" value={String(draftCount)} sub="In progress" icon={FileText} accent="neutral" />
        </Link>
        <Link href="/wine-spectator/contracts?status=pending_events_review" className="block">
          <DashboardStatCard label="Events review" value={String(reviewCount)} sub="Awaiting approval" icon={Clock} accent="amber" />
        </Link>
        <Link href="/wine-spectator/contracts?status=approved" className="block">
          <DashboardStatCard label="Approved" value={String(approvedCount)} sub="Ready to send" icon={CheckCircle2} accent="fest" />
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

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">Recent licenses</CardTitle>
          <Link
            href="/wine-spectator/contracts"
            className="inline-flex items-center gap-1 text-sm font-medium text-accent-brand hover:underline"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No vendor licenses yet. Start from the exhibitor roster.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
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
    </div>
  );
}
