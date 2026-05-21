'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, PanelRightOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'wf-contract-actions-sidebar-open';

function readStoredOpen(): boolean | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

export function useContractActionsSidebar(defaultOpen = false) {
  const [open, setOpenState] = useState(defaultOpen);

  useEffect(() => {
    const stored = readStoredOpen();
    if (stored !== null) setOpenState(stored);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { open, setOpen, toggle };
}

/**
 * Collapsible right panel for contract lifecycle actions.
 */
export function ContractActionsSidebar({
  visible,
  open,
  onOpenChange,
  children,
  title = 'Actions',
}: {
  visible: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
}) {
  if (!visible) return null;

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close actions panel"
          className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[1px] lg:hidden"
          onClick={() => onOpenChange(false)}
        />
      ) : null}

      {/* Collapsed: tab on the right edge */}
      {!open ? (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className={cn(
            'fixed right-0 top-[42%] z-40 flex -translate-y-1/2 items-center gap-1.5',
            'rounded-l-lg border border-r-0 border-border/70 bg-background/95 py-2.5 pl-2.5 pr-2',
            'font-sans text-xs font-medium text-foreground shadow-md backdrop-blur-sm',
            'hover:bg-muted/50 motion-safe:transition-colors',
            'lg:top-1/2',
          )}
        >
          <PanelRightOpen className="h-4 w-4 shrink-0 text-fest-700" aria-hidden />
          <span className="hidden sm:inline">{title}</span>
        </button>
      ) : null}

      {/* Panel */}
      <aside
        id="contract-actions-sidebar"
        aria-label={title}
        className={cn(
          'fixed right-0 z-50 flex w-[min(100vw,17.5rem)] flex-col border-l border-border/60 bg-background shadow-xl',
          'motion-safe:transition-transform motion-safe:duration-200',
          'top-14 h-[calc(100dvh-3.5rem)] sm:top-16 sm:h-[calc(100dvh-4rem)]',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5">
          <h2 className="font-sans text-sm font-semibold text-foreground">{title}</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Close actions panel"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-3 py-3',
            'flex flex-col gap-2',
            '[&_span]:flex [&_span]:w-full [&_button]:w-full',
          )}
        >
          {children}
        </div>
        <div className="shrink-0 border-t border-border/50 p-2 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs"
            onClick={() => onOpenChange(false)}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Close
          </Button>
        </div>
      </aside>
    </>
  );
}

/** Optional label above a group of sidebar actions. */
export function ContractActionsSidebarGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <p className="px-0.5 font-sans text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}
