'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/countdown-timer';
import { CigarAficionadoLogo } from '@/components/brand/cigar-aficionado-logo';
import { HeroParallaxLayer } from '@/components/dashboard/hero-parallax-layer';
import { MagneticButton } from '@/components/motion/magnetic-button';
import { eventCountdownTargetIso, formatEventScheduleLine } from '@/lib/event-schedule';
import { bigSmokeContractCount, BIG_SMOKE_COUNTDOWN_UNTIL } from '@/lib/big-smoke-copy';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/db';

export function BigSmokeHero({
  event,
  contractsCount,
  completionLabel,
  greetingHeadline,
  greetingSubtitle,
  className,
}: {
  event: Event | null;
  contractsCount: number;
  completionLabel: string;
  greetingHeadline?: string;
  greetingSubtitle?: string;
  className?: string;
}) {
  const eventName = event?.name ?? 'Big Smoke Las Vegas';
  const scheduleEvent = event ?? {
    event_date: '2026-11-06',
    event_end_date: '2026-11-07',
    event_start_time: null,
    venue: 'Horseshoe Las Vegas',
  };
  const scheduleLabel = formatEventScheduleLine(scheduleEvent);
  const countdownIso = eventCountdownTargetIso(scheduleEvent);

  return (
    <section
      data-tour="big-smoke-hero"
      className={cn(
        'overflow-hidden rounded-xl border border-amber-900/35 bg-stone-950 shadow-wf-editorial',
        className,
      )}
    >
      <div className="relative h-[480px] overflow-hidden bg-stone-950">
        <HeroParallaxLayer
          src="/images/big-smoke-hero.jpg"
          objectPosition="center 40%"
          imageClassName="opacity-80 sm:opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-stone-950/95" />

        <div className="relative flex h-full flex-col justify-end gap-6 p-6 sm:p-10 lg:p-12">
          <div>
            <CigarAficionadoLogo
              priority
              variant="white"
              className="mb-5 max-w-sm sm:max-w-md"
              imageClassName="max-h-14 w-auto origin-left sm:max-h-16"
            />
            <p className="mb-3 font-sans text-xs uppercase tracking-[0.24em] text-amber-400">Big Smoke</p>
            {greetingHeadline && greetingSubtitle ? (
              <>
                <h1 className="font-display text-5xl font-medium tracking-tight text-parchment-50 sm:text-6xl lg:text-7xl">
                  {greetingHeadline}
                </h1>
                <p className="mt-3 font-display text-xl font-light italic text-parchment-100 sm:text-2xl">
                  {greetingSubtitle}
                </p>
              </>
            ) : (
              <h1 className="font-display text-5xl font-medium tracking-tight text-parchment-50 sm:text-6xl lg:text-7xl">
                {eventName}
              </h1>
            )}
            <p className="mt-3 max-w-2xl font-display text-lg text-parchment-200/95 sm:text-xl">{scheduleLabel}</p>
            <CountdownTimer
              targetDate={scheduleEvent.event_date}
              targetDateTimeIso={countdownIso}
              untilLabel={BIG_SMOKE_COUNTDOWN_UNTIL}
              className="mt-6"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-parchment-300/15 bg-stone-950/90 p-6 text-parchment-100 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-parchment-100/90">{bigSmokeContractCount(contractsCount)}</p>
          <p className="mt-2 text-xs text-parchment-200/90">{completionLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MagneticButton strength={0.65}>
            <Button variant="outline" asChild className="border-border bg-transparent text-parchment-50 hover:bg-muted/10">
              <Link href="/big-smoke/contracts">View all</Link>
            </Button>
          </MagneticButton>
          <MagneticButton strength={0.85}>
            <Button asChild className="bg-amber-700 text-amber-50 shadow-lg shadow-black/25 hover:bg-amber-600">
              <Link href="/big-smoke/contracts/new">
                <Plus className="h-4 w-4" /> New contract
              </Link>
            </Button>
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
