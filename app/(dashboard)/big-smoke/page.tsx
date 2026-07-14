import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/lib/auth';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { formatCurrency } from '@/lib/utils';
import { greetingHour, greetingWord } from '@/lib/dashboard-greeting';
import { PRODUCT_BIG_SMOKE } from '@/lib/product-portal';
import { getDashboardData } from '@/app/(dashboard)/page';
import { StatusBadge } from '@/components/contracts/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BIG_SMOKE_BRAND_LABEL, BIG_SMOKE_SHORT_LABEL } from '@/lib/big-smoke-copy';
import { BIG_SMOKE_EVENT_LOGO } from '@/lib/brand-assets';
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

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-none border border-amber-900/40 bg-black px-6 py-10 text-center sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(180,140,60,0.35), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(60,80,40,0.25), transparent 50%)',
          }}
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-5">
          <Image
            src={BIG_SMOKE_EVENT_LOGO.src}
            alt={BIG_SMOKE_EVENT_LOGO.alt}
            width={BIG_SMOKE_EVENT_LOGO.width}
            height={BIG_SMOKE_EVENT_LOGO.height}
            className="h-auto w-full max-w-md"
            priority
          />
          <div>
            <p className="font-display text-lg text-amber-200/90 sm:text-xl">
              {word}, {first}
            </p>
            <p className="mt-1 text-sm text-stone-400">
              {primaryEvent?.name ?? `${BIG_SMOKE_BRAND_LABEL} · ${BIG_SMOKE_SHORT_LABEL}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="bg-amber-700 text-amber-50 hover:bg-amber-600">
              <Link href="/big-smoke/contracts/new">New contract</Link>
            </Button>
            <Button asChild variant="outline" className="border-amber-800/80 bg-transparent text-amber-100 hover:bg-amber-950/50">
              <Link href="/big-smoke/contracts">All contracts</Link>
            </Button>
            <Button asChild variant="ghost" className="text-stone-300 hover:bg-stone-900 hover:text-amber-100">
              <Link href="/events">Events</Link>
            </Button>
          </div>
        </div>
      </section>

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
            No Big Smoke contracts yet. Create the first exhibitor contract when pricing and the DocuSign template are ready.
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
