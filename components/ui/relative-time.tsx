'use client';

import { useEffect, useState } from 'react';
import { cn, formatRelative } from '@/lib/utils';
import { useHydrated } from '@/hooks/use-hydrated';

/** Client-only relative label ("2h ago") — identical placeholder on server and first client paint. */
export function useRelativeTimeLabel(iso: string | null | undefined): string {
  const hydrated = useHydrated();
  const [label, setLabel] = useState('—');

  useEffect(() => {
    if (!hydrated) return;
    if (!iso) {
      setLabel('—');
      return;
    }
    const tick = () => setLabel(formatRelative(iso));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [iso, hydrated]);

  if (!hydrated || !iso) return '—';
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
  const hydrated = useHydrated();
  const label = useRelativeTimeLabel(iso);

  if (!iso) return <span className={className}>—</span>;

  if (!hydrated) {
    return (
      <time
        dateTime={iso}
        className={cn(className, 'inline-block min-w-[3ch]')}
        title={title}
        suppressHydrationWarning
        aria-hidden
      >
        …
      </time>
    );
  }

  return (
    <time dateTime={iso} className={cn(className)} title={title} suppressHydrationWarning>
      {label}
    </time>
  );
}
