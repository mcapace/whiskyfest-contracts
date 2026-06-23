'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useHydrated } from '@/hooks/use-hydrated';
import { useSafeReducedMotion } from '@/hooks/use-safe-reduced-motion';

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const reduce = useSafeReducedMotion();

  if (!hydrated || reduce) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.85 }}
        className="min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
