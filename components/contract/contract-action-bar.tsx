'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Compact, equal-width controls for the contract bottom bar. */
export const contractActionBtn =
  'h-8 w-full gap-1.5 rounded-md px-2 text-xs font-medium motion-safe:transition-colors';

export const contractActionBtnPrimary =
  `${contractActionBtn} border border-fest-600/20 bg-background text-fest-800 hover:bg-fest-50/80`;

export const contractActionBtnSecondary =
  `${contractActionBtn} border border-border/60 bg-background text-foreground hover:bg-muted/50`;

export const contractActionBtnDanger =
  `${contractActionBtn} border border-danger-base/25 bg-background text-danger-base hover:bg-danger-bg/40`;

/**
 * Fixed bottom action bar — compact, centered, low visual weight.
 */
export function BottomActionBar({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
  /** @deprecated Layout no longer depends on action count. */
  actionsCount?: number;
}) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4',
        'lg:left-64',
      )}
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-md justify-center sm:max-w-lg">
        <div
          className={cn(
            'w-full rounded-lg border border-border/40',
            'bg-background/92 px-2 py-2 shadow-sm backdrop-blur-sm',
          )}
        >
          <div
            className={cn(
              'flex w-full flex-wrap items-stretch justify-center gap-1.5',
              '[&>div]:w-full',
              '[&>span]:min-w-0 [&>span]:flex-1 [&>span]:basis-[calc(50%-0.375rem)] sm:[&>span]:min-w-[7.25rem] sm:[&>span]:max-w-[9.5rem]',
              '[&_button]:w-full',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wrapper for grouped actions (e.g. DocuSign). */
export function ContractActionBarSection({ children }: { children: ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>;
}

/** Two-column grid — equal cell widths for symmetrical layout. */
export function ContractActionBarGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full grid-cols-2 gap-1.5">{children}</div>
  );
}

/** One grid cell; stretches the action control to full cell width. */
export function ContractActionBarCell({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 [&_button]:w-full [&_span]:flex [&_span]:w-full">{children}</div>
  );
}

/** Horizontal row with equal flex widths (fewer than ~4 actions). */
export function ContractActionBarRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-stretch justify-center gap-1.5',
        '[&_span]:min-w-0 [&_span]:flex-1 [&_span]:basis-[calc(50%-0.25rem)]',
        '[&_button]:w-full',
        'sm:[&_span]:basis-auto sm:[&_span]:min-w-[7.5rem]',
        className,
      )}
    >
      {children}
    </div>
  );
}
