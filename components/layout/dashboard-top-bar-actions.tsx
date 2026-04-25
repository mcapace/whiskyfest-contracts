'use client';

import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { CommandPaletteTrigger } from '@/components/command-palette/command-palette';
import { HelpMenu } from '@/components/help-menu';
import { ImpersonationViewAsTopbarButton } from '@/components/impersonation/impersonation-view-as-topbar-button';

function LocalDateTimePill() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);

  return (
    <div
      className="hidden rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:block"
      aria-label={`Local date and time: ${dateLabel} ${timeLabel}`}
      title="Local date and time"
    >
      {dateLabel} · {timeLabel}
    </div>
  );
}

export function DashboardTopBarActions() {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <LocalDateTimePill />
      <ImpersonationViewAsTopbarButton />
      <HelpMenu />
      <ThemeToggle />
      <CommandPaletteTrigger />
    </div>
  );
}
