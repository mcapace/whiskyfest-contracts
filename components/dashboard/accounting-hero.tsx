'use client';

import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { AccountingPortalKey } from '@/lib/accounting-portal';

export function AccountingHero({
  productKey,
  title,
  subtitle,
  arTotalCents,
  pendingCount,
  sentCount,
  paidCount,
  dashboardBase,
  className,
}: {
  productKey: AccountingPortalKey;
  title: string;
  subtitle: string;
  arTotalCents: number;
  pendingCount: number;
  sentCount: number;
  paidCount: number;
  dashboardBase: string;
  className?: string;
}) {
  const isNywe = productKey === 'wine_spectator';

  return (
    <section
      data-tour="accounting-hero"
      className={cn(
        'overflow-hidden rounded-xl border shadow-wf-editorial',
        isNywe
          ? 'border-oak-800/30 bg-gradient-to-br from-stone-900 via-oak-900 to-stone-950'
          : 'border-brass-700/25 bg-gradient-to-br from-stone-900 via-oak-900 to-stone-950',
        className,
      )}
    >
      <div className="relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
        <div
          className={cn(
            'absolute inset-0',
            isNywe
              ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.12),transparent_55%)]'
              : 'bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.14),transparent_55%)]',
          )}
        />
        <div className="relative">
          <div
            className={cn(
              'mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]',
              isNywe ? 'border-amber-500/30 bg-oak-950/40 text-amber-200' : 'border-brass-500/30 bg-brass-950/40 text-brass-300',
            )}
          >
            <Landmark className="h-3.5 w-3.5" />
            Accounts Receivable
          </div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-parchment-50 sm:text-5xl">{title}</h1>
          <p className="mt-3 max-w-2xl font-display text-lg text-parchment-200/95 sm:text-xl">{subtitle}</p>
          <p className="mt-4 font-mono text-3xl font-semibold tabular-nums text-parchment-50 sm:text-4xl">
            {formatCurrency(arTotalCents)}
            <span className="ml-2 text-sm font-sans font-normal text-parchment-300/90">total AR value</span>
          </p>
        </div>
      </div>

      <div className="grid gap-px border-t border-parchment-300/10 bg-black/20 sm:grid-cols-3">
        <HeroStat label="Pending invoicing" count={pendingCount} href={`${dashboardBase}?invoice=pending`} />
        <HeroStat label="Invoice sent" count={sentCount} href={`${dashboardBase}?invoice=invoice_sent`} />
        <HeroStat label="Paid" count={paidCount} href={`${dashboardBase}?invoice=paid`} />
      </div>
    </section>
  );
}

function HeroStat({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 px-6 py-4 transition-colors hover:bg-white/[0.03] sm:px-8"
    >
      <span className="text-xs uppercase tracking-wide text-parchment-300/80">{label}</span>
      <span className="font-mono text-2xl font-semibold tabular-nums text-parchment-50">{count}</span>
    </Link>
  );
}
