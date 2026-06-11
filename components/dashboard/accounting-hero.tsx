'use client';

import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function AccountingHero({
  arTotalCents,
  pendingCount,
  sentCount,
  paidCount,
  className,
}: {
  arTotalCents: number;
  pendingCount: number;
  sentCount: number;
  paidCount: number;
  className?: string;
}) {
  return (
    <section
      data-tour="accounting-hero"
      className={cn(
        'overflow-hidden rounded-xl border border-brass-700/25 bg-gradient-to-br from-stone-900 via-oak-900 to-stone-950 shadow-wf-editorial',
        className,
      )}
    >
      <div className="relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.14),transparent_55%)]" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brass-500/30 bg-brass-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brass-300">
            <Landmark className="h-3.5 w-3.5" />
            Accounts Receivable
          </div>
          <h1 className="font-display text-4xl font-medium tracking-tight text-parchment-50 sm:text-5xl">
            Accounting Dashboard
          </h1>
          <p className="mt-3 max-w-2xl font-display text-lg text-parchment-200/95 sm:text-xl">
            Executed contracts · invoice tracking · WhiskyFest &amp; Wine Spectator
          </p>
          <p className="mt-4 font-mono text-3xl font-semibold tabular-nums text-parchment-50 sm:text-4xl">
            {formatCurrency(arTotalCents)}
            <span className="ml-2 text-sm font-sans font-normal text-parchment-300/90">total AR value</span>
          </p>
        </div>
      </div>

      <div className="grid gap-px border-t border-parchment-300/10 bg-black/20 sm:grid-cols-3">
        <HeroStat label="Pending invoicing" count={pendingCount} href="/accounting?invoice=pending" />
        <HeroStat label="Invoice sent" count={sentCount} href="/accounting?invoice=invoice_sent" />
        <HeroStat label="Paid" count={paidCount} href="/accounting?invoice=paid" />
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
