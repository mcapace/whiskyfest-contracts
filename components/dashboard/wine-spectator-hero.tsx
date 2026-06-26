'use client';

import Link from 'next/link';
import { NyweLogo } from '@/components/brand/nywe-logo';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/countdown-timer';
import { HeroParallaxLayer } from '@/components/dashboard/hero-parallax-layer';
import { MagneticButton } from '@/components/motion/magnetic-button';
import { eventCountdownTargetIso, formatEventScheduleLine } from '@/lib/event-schedule';
import { cn } from '@/lib/utils';
import { nyweContractCount } from '@/lib/nywe-copy';
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
  /** Smaller hero for secondary pages (e.g. roster). */
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
      <div className={cn('relative overflow-hidden bg-rose-950', compact ? 'min-h-[300px] sm:min-h-[340px]' : 'h-[480px]')}>
        <HeroParallaxLayer
          src="/images/nywe-hero.png"
          objectPosition="center 42%"
          imageClassName="opacity-75 sm:opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-rose-950/25 via-rose-950/55 to-rose-950/95" />

        <div className="relative flex h-full flex-col justify-end gap-6 p-6 sm:p-10 lg:p-12">
          <div>
            <NyweLogo
              priority
              variant="onDark"
              className={cn('mb-5 max-w-sm sm:max-w-md', compact && 'mb-4 max-w-[11rem] sm:max-w-xs')}
              imageClassName={cn(
                'max-h-16 w-auto origin-left sm:max-h-[4.5rem]',
                compact && 'max-h-12 sm:max-h-14',
              )}
            />
            <p className="mb-3 font-sans text-xs uppercase tracking-[0.24em] text-brass-200">
              New York Wine Experience
            </p>
            {greetingHeadline && greetingSubtitle ? (
              <>
                <h1
                  className={cn(
                    'font-display font-medium tracking-tight text-parchment-50',
                    compact ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl lg:text-7xl',
                  )}
                >
                  {greetingHeadline}
                </h1>
                <p
                  className={cn(
                    'font-display font-light italic text-parchment-100',
                    compact ? 'mt-2 text-base sm:text-lg' : 'mt-3 text-xl sm:text-2xl',
                  )}
                >
                  {greetingSubtitle}
                </p>
              </>
            ) : (
              <h1
                className={cn(
                  'font-display font-medium tracking-tight text-parchment-50',
                  compact ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl lg:text-7xl',
                )}
              >
                {eventName}
              </h1>
            )}
            <p
              className={cn(
                'max-w-2xl font-display text-parchment-200/95',
                compact ? 'mt-2 text-base sm:text-lg' : 'mt-3 text-lg sm:text-xl',
              )}
            >
              {scheduleLabel}
            </p>
            <CountdownTimer
              targetDate={scheduleEvent.event_date}
              targetDateTimeIso={countdownIso}
              className={cn(compact ? 'mt-4' : 'mt-6')}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-parchment-300/15 bg-rose-950/90 p-6 text-parchment-100 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-parchment-100/90">{nyweContractCount(contractsCount)}</p>
          <p className="mt-2 text-xs text-parchment-200/90">{completionLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MagneticButton strength={0.65}>
            <Button variant="outline" asChild className="border-border bg-transparent text-parchment-50 hover:bg-muted/10">
              <Link href="/wine-spectator/contracts">View all</Link>
            </Button>
          </MagneticButton>
          <MagneticButton strength={0.85}>
            <Button
              asChild
              className="bg-brass-200 text-rose-950 shadow-lg shadow-black/25 hover:bg-brass-100 hover:text-rose-950"
            >
              <Link href="/wine-spectator/contracts/new">
                <Plus className="h-4 w-4" /> New contract
              </Link>
            </Button>
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
