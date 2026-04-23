'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Sticky top chrome — right slot used by command palette trigger and theme toggle.
 */
export function Topbar({
  title,
  className,
  endSlot,
}: {
  title?: string | null;
  className?: string;
  endSlot?: ReactNode;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-border/50 bg-bg-surface-raised/90 backdrop-blur-md supports-[backdrop-filter]:bg-bg-surface-raised/75',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6 lg:max-w-none lg:px-10">
        <div className="min-w-0">
          {title ? (
            <h1 className="truncate font-serif text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          ) : (
            <p className="wf-label-caps text-[0.65rem] text-muted-foreground">WhiskyFest · Contracts</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">{endSlot}</div>
      </div>
    </header>
  );
}
