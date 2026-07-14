'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useHydrated } from '@/hooks/use-hydrated';

export function CountdownTimer({
  targetDate,
  targetDateTimeIso,
  untilLabel = 'until pour begins',
  className,
}: {
  targetDate: string;
  targetDateTimeIso?: string;
  /** Suffix after the countdown (product-specific). */
  untilLabel?: string;
  className?: string;
}) {
  const hydrated = useHydrated();
  const targetMs = useMemo(() => {
    if (targetDateTimeIso) return new Date(targetDateTimeIso).getTime();
    return new Date(`${targetDate}T00:00:00`).getTime();
  }, [targetDate, targetDateTimeIso]);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setNowMs(Date.now());
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!hydrated || nowMs == null) {
    return (
      <p
        className={cn('font-sans text-sm text-parchment-100/95 sm:text-base', className)}
        suppressHydrationWarning
        aria-hidden
      >
        <span className="font-semibold tabular-nums text-parchment-50">—</span> days ·{' '}
        <span className="font-semibold tabular-nums text-parchment-50">—</span> hours ·{' '}
        <span className="font-semibold tabular-nums text-parchment-50">—</span> minutes · {untilLabel}
      </p>
    );
  }

  const delta = Math.max(0, targetMs - nowMs);
  const totalMinutes = Math.floor(delta / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return (
    <p className={cn('font-sans text-sm text-parchment-100/95 sm:text-base', className)}>
      <span className="font-semibold tabular-nums text-parchment-50">{days}</span> days ·{' '}
      <span className="font-semibold tabular-nums text-parchment-50">{hours}</span> hours ·{' '}
      <span className="font-semibold tabular-nums text-parchment-50">{minutes}</span> minutes · {untilLabel}
    </p>
  );
}
