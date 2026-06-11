'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/countdown-timer';
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
}: {
  event: Event | null;
  contractsCount: number;
  completionLabel: string;
  greetingHeadline?: string;
  greetingSubtitle?: string;
  className?: string;
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
        'overflow-hidden rounded-xl border border-rose-900/25 bg-gradient-to-br from-rose-950 via-rose-900 to-stone-900 shadow-wf-editorial',
        className,
      )}
    >
      <div className="relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.12),transparent_55%)]" />
        <div className="relative">
          <div className="mb-6 inline-block max-w-sm rounded-lg bg-black px-4 py-3 shadow-lg sm:max-w-md">
            <Image
              src="/images/nywe-logo.png"
              alt="Wine Spectator New York Wine Experience"
              width={514}
              height={174}
              priority
              className="h-auto w-full object-contain"
            />
          </div>
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

      <div className="grid gap-4 border-t border-parchment-300/15 bg-black/20 p-6 text-parchment-100 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm leading-relaxed text-parchment-100/90">
            {contractsCount} vendor license{contractsCount !== 1 ? 's' : ''} in this workspace
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
