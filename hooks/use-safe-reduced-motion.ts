'use client';

import { useReducedMotion } from 'framer-motion';
import { useHydrated } from '@/hooks/use-hydrated';

/**
 * Framer Motion branches on reduced-motion during render; when SSR and the first client
 * paint disagree, motion internals can hit React #310 on older corporate browsers.
 * Until hydration, treat motion as reduced (static markup only).
 */
export function useSafeReducedMotion(): boolean {
  const hydrated = useHydrated();
  const reduce = useReducedMotion();
  if (!hydrated) return true;
  return reduce ?? false;
}
