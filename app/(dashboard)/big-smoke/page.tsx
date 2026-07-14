import Link from 'next/link';
import { auth } from '@/lib/auth';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { formatCurrency } from '@/lib/utils';
import { greetingHour, greetingWord } from '@/lib/dashboard-greeting';
import { PRODUCT_BIG_SMOKE } from '@/lib/product-portal';
import { getDashboardData } from '@/app/(dashboard)/page';
import { BigSmokeHero } from '@/components/dashboard/big-smoke-hero';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ContractWithTotals } from '@/types/db';

export const dynamic = 'force-dynamic';

function countByStatus(contracts: ContractWithTotals[], statuses: string[]): number {
  return contracts.filter((c) => statuses.includes(c.status)).length;
}

export default async function BigSmokeDashboardPage() {
  const session = await auth();
  const actor = await requireContractActorForPage();
  const { contracts: allScoped, events } = await getDashboardData(actor, PRODUCT_BIG_SMOKE);

  const activeScoped = allScoped.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');
  const primaryEvent = events.find((e) => e.is_active) ?? events[0] ?? null;
  const draftCount = countByStatus(activeScoped, ['draft', 'ready_for_review', 'pending_events_review']);
  const sentCount = countByStatus(activeScoped, ['sent']);
  const executedCount = countByStatus(activeScoped, ['signed', 'executed']);
  const totalValueCents = activeScoped.reduce((sum, c) => sum + c.grand_total_cents, 0);

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

  const completionParts = [
    draftCount > 0 ? `${draftCount} in draft / review` : null,
    sentCount > 0 ? `${sentCount} awaiting signature` : null,
    executedCount > 0 ? `${executedCount} signed or executed` : null,
  ].filter(Boolean);
  const completionLabel =
    completionParts.length > 0 ? completionParts.join(' · ') : 'No active contracts yet';

  return (
    <div className="space-y-10">
      <BigSmokeHero
        event={primaryEvent}
        contractsCount={activeScoped.length}
        completionLabel={completionLabel}
        greetingHeadline={`${word}, ${first}`}
        greetingSubtitle={primaryEvent?.tagline ?? 'Cigar Aficionado · Big Smoke'}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'In pipeline', value: String(activeScoped.length) },
          { label: 'Draft / review', value: String(draftCount) },
          { label: 'Awaiting signature', value: String(sentCount) },
          { label: 'Pipeline value', value: formatCurrency(totalValueCents) },
        ].map((m) => (
          <div key={m.label} className="border-b border-border pb-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="mt-1 font-display text-2xl text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-foreground">Recent contracts</h2>
            <p className="text-sm text-muted-foreground">
              {executedCount} signed or executed · {primaryEvent?.venue ?? 'Horseshoe Las Vegas'}
            </p>
          </div>
          <Link href="/big-smoke/contracts" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Big Smoke contracts yet. Create the first exhibitor contract to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/big-smoke/contracts/${c.id}`} className="font-medium hover:underline">
                      {c.exhibitor_company_name || c.exhibitor_legal_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(c.grand_total_cents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
