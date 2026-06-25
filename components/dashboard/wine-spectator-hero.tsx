'use client';

import Link from 'next/link';
import { NyweLogo } from '@/components/brand/nywe-logo';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/countdown-timer';
import { HeroParallaxLayer } from '@/components/dashboard/hero-parallax-layer';
import { eventCountdownTargetIso, formatEventScheduleLine } from '@/lib/event-schedule';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/db';

export function WineSpectatorHero({
  event,
  contractsCount,
  completionLabel,
  greetingHeadline,
  greetingSubtitle,
  className,
  compact,
}: {
  event: Event | null;
  contractsCount: number;
  completionLabel: string;
  greetingHeadline?: string;
  greetingSubtitle?: string;
  className?: string;
  compact?: boolean;
}) {
  const eventName = event?.name ?? 'New York Wine Experience';
  const scheduleEvent = event ?? {
    event_date: '2026-10-22',
    event_end_date: '2026-10-24',
    event_start_time: '6:00 PM',
    venue: 'Marriott Marquis, 1535 Broadway, New York, NY 10036',
  };
  const scheduleLabel = formatEventScheduleLine(scheduleEvent);
  const countdownIso = eventCountdownTargetIso(scheduleEvent);

  return (
    <section
      data-tour="wine-spectator-hero"
      className={cn(
        'overflow-hidden rounded-xl border border-rose-900/25 bg-rose-950 shadow-wf-editorial',
        className,
      )}
    >
      <div className={cn('relative overflow-hidden bg-rose-950', compact ? 'h-[320px]' : 'h-[480px]')}>
        <HeroParallaxLayer
          src="/images/nywe-hero.png"
          objectPosition="center 42%"
          imageClassName="opacity-75 sm:opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-rose-950/25 via-rose-950/55 to-rose-950/95" />

        <div className="relative flex h-full flex-col justify-end gap-6 p-6 sm:p-10 lg:p-12">
          <div>
            <NyweLogo
              onDark
              priority
              className="mb-6 max-w-sm sm:max-w-md"
              imageClassName="max-h-16 sm:max-h-[4.5rem]"
            />
            {greetingHeadline && greetingSubtitle ? (
              <>
                <h1 className="font-display text-4xl font-medium tracking-tight text-parchment-50 sm:text-5xl lg:text-6xl">
                  {greetingHeadline}
                </h1>
                <p className="mt-3 font-display text-lg font-light italic text-parchment-100 sm:text-xl">
                  {greetingSubtitle}
                </p>
              </>
            ) : (
              <h1 className="font-display text-4xl font-medium tracking-tight text-parchment-50 sm:text-5xl lg:text-6xl">
                {eventName}
              </h1>
            )}
            <p className="mt-3 max-w-2xl font-display text-lg text-parchment-200/95 sm:text-xl">
              {scheduleLabel}
            </p>
            <CountdownTimer
              targetDate={scheduleEvent.event_date}
              targetDateTimeIso={countdownIso}
              className="mt-6"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-parchment-300/15 bg-rose-950/90 p-6 text-parchment-100 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-parchment-100/90">
            {contractsCount} vendor license{contractsCount !== 1 ? 's' : ''}
          </p>
          <p className="mt-2 text-xs text-parchment-200/90">{completionLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="border-border bg-transparent text-parchment-50 hover:bg-muted/10">
            <Link href="/wine-spectator/contracts">View all</Link>
          </Button>
          <Button asChild className="bg-amber-600 text-parchment-50 shadow-lg shadow-amber-950/25 hover:bg-amber-700">
            <Link href="/wine-spectator/contracts/new">
              <Plus className="h-4 w-4" /> New vendor license
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
