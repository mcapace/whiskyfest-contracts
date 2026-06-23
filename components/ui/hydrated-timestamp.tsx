'use client';

import { useEffect, useState } from 'react';
import { formatTimestamp } from '@/lib/utils';
import { useHydrated } from '@/hooks/use-hydrated';

/** Audit timestamps can differ slightly between Node and older browsers — render after hydration. */
export function HydratedTimestamp({
  iso,
  className,
}: {
  iso: string | null | undefined;
  className?: string;
}) {
  const hydrated = useHydrated();
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!hydrated) return;
    setLabel(formatTimestamp(iso));
  }, [hydrated, iso]);

  if (!iso) return <span className={className}>—</span>;

  if (!hydrated) {
    return (
      <span className={className} suppressHydrationWarning aria-hidden>
        …
      </span>
    );
  }

  return (
    <span className={className} suppressHydrationWarning>
      {label || '—'}
    </span>
  );
}
