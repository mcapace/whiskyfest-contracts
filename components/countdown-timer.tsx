'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export function CountdownTimer({
  targetDate,
  targetDateTimeIso,
  className,
}: {
  targetDate: string;
  targetDateTimeIso?: string;
  className?: string;
}) {
  const targetMs = useMemo(() => {
    if (targetDateTimeIso) return new Date(targetDateTimeIso).getTime();
    return new Date(`${targetDate}T00:00:00`).getTime();
  }, [targetDate, targetDateTimeIso]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const delta = Math.max(0, targetMs - nowMs);
  const totalMinutes = Math.floor(delta / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return (
    <p className={cn('font-sans text-sm text-parchment-100/95 sm:text-base', className)}>
      <span className="font-semibold tabular-nums text-parchment-50">{days}</span> days ·{' '}
      <span className="font-semibold tabular-nums text-parchment-50">{hours}</span> hours ·{' '}
      <span className="font-semibold tabular-nums text-parchment-50">{minutes}</span> minutes · until pour begins
    </p>
  );
}
