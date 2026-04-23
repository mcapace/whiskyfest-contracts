'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Arc-style floating pill; on small screens becomes a fixed bottom bar. */
export function FloatingActionBar({ visible, children }: { visible: boolean; children: ReactNode }) {
  if (!visible) return null;

  return (
    <div className={cn('pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4', 'lg:left-64')}>
      <div
        className={cn(
          'pointer-events-auto mx-auto flex max-w-6xl justify-end lg:px-6',
          'max-sm:justify-center',
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/60',
            'bg-bg-surface-raised/95 px-3 py-2 shadow-wf-floating backdrop-blur-md',
            'motion-safe:transition motion-safe:duration-200',
            'max-sm:w-full max-sm:rounded-2xl max-sm:px-3 max-sm:py-3',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
