'use client';

import { useEffect, useState } from 'react';
import { cn, formatLongDate, formatRelative } from '@/lib/utils';

function stableFallback(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatLongDate(iso);
}

/** Client-only relative label ("2h ago") to avoid SSR/hydration mismatches from Date.now(). */
export function useRelativeTimeLabel(iso: string | null | undefined): string {
  const [label, setLabel] = useState(() => stableFallback(iso));

  useEffect(() => {
    if (!iso) {
      setLabel('—');
      return;
    }
    const tick = () => setLabel(formatRelative(iso));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return label;
}

export function RelativeTime({
  iso,
  className,
  title,
}: {
  iso: string | null | undefined;
  className?: string;
  title?: string;
}) {
  const label = useRelativeTimeLabel(iso);
  if (!iso) return <span className={className}>—</span>;

  return (
    <time dateTime={iso} className={cn(className)} title={title} suppressHydrationWarning>
      {label}
    </time>
  );
}
