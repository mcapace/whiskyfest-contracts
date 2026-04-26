'use client';

import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/countdown-timer';
import { cn } from '@/lib/utils';
import { HeroParallaxLayer } from '@/components/dashboard/hero-parallax-layer';
import { MagneticButton } from '@/components/motion/magnetic-button';

export function DashboardHero({
  contractsCount,
  eventsCount,
  supportedRepNames,
  completionLabel,
  progressPct,
  className,
  greetingHeadline,
  greetingSubtitle,
}: {
  contractsCount: number;
  eventsCount: number;
  supportedRepNames: string[];
  completionLabel: string;
  progressPct: number;
  className?: string;
  /** When set, replaces default hero title block with personalized greeting (Phase 3). */
  greetingHeadline?: string;
  greetingSubtitle?: string;
}) {
  return (
    <section
      data-tour="dashboard-hero"
      className={cn(
        'overflow-hidden rounded-xl border border-oak-800/30 bg-oak-900 shadow-wf-editorial',
        className,
      )}
    >
      <div className="relative h-[480px] overflow-hidden bg-oak-900">
        <HeroParallaxLayer />
        <div className="absolute inset-0 bg-gradient-to-b from-oak-900/10 via-oak-900/35 to-oak-900/95" />

        <div className="relative flex h-full flex-col justify-end gap-6 p-6 sm:p-10 lg:p-12">
          <div>
            <p className="mb-3 font-sans text-xs uppercase tracking-[0.24em] text-amber-500">
              WhiskyFest 2026
            </p>
            {greetingHeadline && greetingSubtitle ? (
              <>
                <h1 className="font-display text-5xl font-medium tracking-tight text-parchment-50 sm:text-6xl lg:text-7xl">
                  {greetingHeadline}
                </h1>
                <p className="mt-3 font-display text-xl font-light italic text-parchment-100 sm:text-2xl">
                  {greetingSubtitle}
                </p>
                <p className="mt-2 font-display text-lg text-parchment-200/95 sm:text-xl">
                  WhiskyFest New York · November 20, 2026 · Marriott Marquis
                </p>
              </>
            ) : (
              <>
                <p className="mb-1 font-sans text-[11px] uppercase tracking-[0.2em] text-parchment-300/90">
                  M. Shanken Communications
                </p>
                <h1 className="font-display text-5xl font-medium tracking-tight text-parchment-50 sm:text-6xl lg:text-7xl">
                  WhiskyFest New York
                </h1>
                <p className="mt-3 font-display text-xl font-light italic text-parchment-100 sm:text-2xl">
                  November 20, 2026 · 6:30-9:30 PM EST · Marriott Marquis
                </p>
              </>
            )}
            <CountdownTimer targetDate="2026-11-20" targetDateTimeIso="2026-11-20T18:30:00-05:00" className="mt-6" />
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
          <MagneticButton strength={0.65}>
            <Button variant="outline" asChild className="border-parchment-200/50 bg-transparent text-parchment-50 hover:bg-parchment-100/10">
              <Link href="/contracts">View all</Link>
            </Button>
          </MagneticButton>
          <MagneticButton strength={0.85}>
            <Button asChild className="bg-amber-600 text-parchment-50 shadow-lg shadow-amber-950/25 hover:bg-amber-700">
              <Link href="/contracts/new" data-tour="new-contract-btn">
                <Plus className="h-4 w-4" /> New Contract
              </Link>
            </Button>
          </MagneticButton>
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
