import Link from 'next/link';
import Image from 'next/image';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/countdown-timer';
import { cn } from '@/lib/utils';

export function DashboardHero({
  contractsCount,
  eventsCount,
  supportedRepNames,
  completionLabel,
  progressPct,
  className,
}: {
  contractsCount: number;
  eventsCount: number;
  supportedRepNames: string[];
  completionLabel: string;
  progressPct: number;
  className?: string;
}) {
  return (
    <section
      data-tour="dashboard-hero"
      className={cn(
        'overflow-hidden rounded-xl border border-oak-800/30 bg-oak-900',
        className,
      )}
    >
      <div className="relative h-[480px] overflow-hidden bg-oak-900">
        <Image
          src="/images/whiskyfest-hero.jpg"
          alt="WhiskyFest"
          fill
          className="object-cover opacity-45"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-oak-900/20 to-oak-900" />

        <div className="relative flex h-full flex-col justify-end gap-6 p-6 sm:p-10 lg:p-12">
          <div>
            <p className="mb-3 font-sans text-xs uppercase tracking-[0.24em] text-amber-500">
              M. Shanken Communications · WhiskyFest 2026
            </p>
            <h1 className="font-display text-5xl font-medium tracking-tight text-parchment-50 sm:text-6xl lg:text-7xl">
              WhiskyFest New York
            </h1>
            <p className="mt-3 font-display text-xl font-light italic text-parchment-100 sm:text-2xl">
              November 20, 2026 · Marriott Marquis
            </p>
            <CountdownTimer targetDate="2026-11-20" className="mt-6" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-parchment-300/20 bg-oak-900/85 p-6 text-parchment-100 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-parchment-100/90">
            {contractsCount} total contracts · {eventsCount} active event{eventsCount !== 1 ? 's' : ''}
          </p>
          {supportedRepNames.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-parchment-100/90">
              <Users className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                Supporting: <span className="font-medium text-parchment-50">{supportedRepNames.join(', ')}</span>
              </span>
            </p>
          )}
          <p className="mt-2 text-xs text-parchment-200/90">{completionLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="border-parchment-200/50 bg-transparent text-parchment-50 hover:bg-parchment-100/10">
            <Link href="/contracts">View all</Link>
          </Button>
          <Button asChild className="bg-amber-600 text-parchment-50 hover:bg-amber-700">
            <Link href="/contracts/new" data-tour="new-contract-btn">
              <Plus className="h-4 w-4" /> New Contract
            </Link>
          </Button>
        </div>
      </div>
      <div className="hidden px-6 pb-6 sm:block" data-tour="dashboard-stats">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="wf-label-caps text-[0.6rem] text-parchment-200/90">Pipeline completion</span>
          <span className="text-right font-mono text-xs tabular-nums text-parchment-200/90">{progressPct}% complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-parchment-200/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-copper-500 transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
