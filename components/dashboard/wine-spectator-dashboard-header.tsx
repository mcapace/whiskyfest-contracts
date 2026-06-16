'use client';

import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatEventScheduleLine } from '@/lib/event-schedule';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Event } from '@/types/db';

/** Compact SaaS-style dashboard header — no full-bleed hero. */
export function WineSpectatorDashboardHeader({
  event,
  contractsCount,
  totalValueCents,
  greetingHeadline,
  sendBlocked,
  className,
}: {
  event: Event | null;
  contractsCount: number;
  totalValueCents: number;
  greetingHeadline: string;
  sendBlocked?: boolean;
  className?: string;
}) {
  const scheduleEvent = event ?? {
    event_date: '2026-10-22',
    event_end_date: '2026-10-24',
    event_start_time: '6:00 PM',
    venue: 'Marriott Marquis, 1535 Broadway, New York, NY 10036',
  };
  const scheduleLabel = formatEventScheduleLine(scheduleEvent);

  return (
    <section
      data-tour="wine-spectator-hero"
      className={cn(
        'rounded-xl border border-border/60 bg-white p-6 shadow-sm dark:bg-bg-surface',
        className,
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{greetingHeadline}</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {event?.name ?? 'New York Wine Experience'}
          </h2>
          <p className="text-sm text-muted-foreground">{scheduleLabel}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold tabular-nums text-foreground">{contractsCount}</span> licenses
            </span>
            <span>
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(totalValueCents)}</span> pipeline value
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/wine-spectator/roster">
              <Users className="h-4 w-4" />
              Exhibitor roster
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/wine-spectator/contracts/new">
              <Plus className="h-4 w-4" />
              New license
            </Link>
          </Button>
        </div>
      </div>
      {sendBlocked ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Client send is disabled — prepare and approve licenses internally until enabled in Event settings.
        </div>
      ) : null}
    </section>
  );
}
