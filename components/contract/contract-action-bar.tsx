'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared button sizing for the contract bottom action bar. */
export const contractActionBtn =
  'h-9 shrink-0 gap-2 rounded-lg px-3.5 text-sm font-medium motion-safe:transition-colors';

export const contractActionBtnPrimary =
  `${contractActionBtn} bg-fest-700 text-parchment-50 shadow-sm hover:bg-fest-800`;

export const contractActionBtnSecondary =
  `${contractActionBtn} border border-border bg-background text-foreground hover:bg-muted/60`;

/** Outline — cancel, secondary destructive */
export const contractActionBtnDanger =
  `${contractActionBtn} border border-danger-base/35 bg-background text-danger-base hover:bg-danger-bg/50`;

/** Solid — void and other irreversible actions */
export const contractActionBtnDangerSolid =
  `${contractActionBtn} bg-danger-base text-white shadow-sm hover:bg-danger-base/90`;

/**
 * Fixed bottom action bar — card layout with optional grouped sections.
 */
export function BottomActionBar({
  visible,
  children,
  actionsCount,
}: {
  visible: boolean;
  children: ReactNode;
  actionsCount: number;
}) {
  if (!visible) return null;

  const stacked = actionsCount >= 4;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4',
        'lg:left-64',
      )}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-3xl lg:max-w-4xl">
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-border/70',
            'bg-card/95 shadow-xl backdrop-blur-md',
            stacked ? '' : 'px-3 py-2.5',
          )}
        >
          <div
            className={cn(
              stacked
                ? 'flex flex-col divide-y divide-border/60'
                : 'flex flex-wrap items-center justify-end gap-2',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Grouped block inside the action bar (e.g. DocuSign controls).
 */
export function ContractActionBarSection({
  title,
  description,
  children,
  tone = 'default',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <div
      className={cn(
        'px-4 py-3',
        tone === 'danger' && 'bg-danger-bg/30',
      )}
    >
      {(title || description) && (
        <div className="mb-2.5 space-y-0.5">
          {title ? (
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-foreground">
              {title}
            </p>
          ) : null}
          {description ? (
            <p className="font-sans text-xs leading-snug text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}

/** Row of actions within a section. */
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
        'flex flex-wrap items-center gap-2',
        'max-sm:[&_button]:min-h-10 max-sm:[&_button]:flex-1 max-sm:[&_button]:justify-center',
        className,
      )}
    >
      {children}
    </div>
  );
}
