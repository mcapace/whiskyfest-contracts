'use client';

import { useEffect, useState } from 'react';

/** True after the first client paint — use to defer Date.now / locale formatting until hydration completes. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
