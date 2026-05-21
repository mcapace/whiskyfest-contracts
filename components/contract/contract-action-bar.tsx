'use client';

import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared button sizing for contract action controls (sidebar). */
export const contractActionBtn =
  'h-9 w-full justify-start gap-2 rounded-md px-3 text-sm font-medium motion-safe:transition-colors';

/** Icon + label for sidebar action buttons; shows spinner when `spinning`. */
export function ContractActionButtonLabel({
  icon: Icon,
  label,
  spinning = false,
}: {
  icon: LucideIcon;
  label: string;
  spinning?: boolean;
}) {
  return (
    <span className="inline-flex w-full min-w-0 items-center justify-start gap-2">
      {spinning ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

export const contractActionBtnPrimary =
  `${contractActionBtn} border border-fest-600/25 bg-fest-50/50 text-fest-800 hover:bg-fest-50`;

export const contractActionBtnSecondary =
  `${contractActionBtn} border border-border/60 bg-background text-foreground hover:bg-muted/50`;

export const contractActionBtnDanger =
  `${contractActionBtn} border border-danger-base/30 bg-background text-danger-base hover:bg-danger-bg/40`;

/** @deprecated Use ContractActionsSidebar instead. */
export function BottomActionBar({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
  actionsCount?: number;
}) {
  if (!visible) return null;
  return <div className="hidden">{children}</div>;
}

/** @deprecated */
export function ContractActionBarSection({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** @deprecated */
export function ContractActionBarGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

/** @deprecated */
export function ContractActionBarCell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** @deprecated */
export function ContractActionBarRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('flex flex-col gap-1.5', className)}>{children}</div>;
}
