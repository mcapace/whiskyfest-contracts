'use client';

import { useEffect, useState } from 'react';
import { useHydrated } from '@/hooks/use-hydrated';

/**
 * Avoid framer-motion's useReducedMotion — it can change internal hook counts between
 * SSR and client on corporate browsers (React #310). Use matchMedia after hydration.
 */
export function useSafeReducedMotion(): boolean {
  const hydrated = useHydrated();
  const [reduce, setReduce] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (!hydrated) return true;
  return reduce;
}
