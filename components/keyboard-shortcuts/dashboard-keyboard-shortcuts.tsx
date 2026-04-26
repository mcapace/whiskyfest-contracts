'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const GO_WINDOW_MS = 950;

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

type ShortcutsCtx = { openShortcutsModal: () => void };

const ShortcutsModalContext = createContext<ShortcutsCtx | null>(null);

export function useOpenShortcutsModal(): ShortcutsCtx | null {
  return useContext(ShortcutsModalContext);
}

const rows: { keys: string; action: string }[] = [
  { keys: 'g then d', action: 'Go to Dashboard' },
  { keys: 'g then c', action: 'Go to All Contracts' },
  { keys: 'g then s', action: 'Go to Sponsors' },
  { keys: 'c', action: 'New contract (when focus is not in a field)' },
  { keys: '? or Shift + /', action: 'Open this shortcuts list' },
  { keys: '⌘ K / Ctrl + K', action: 'Command palette (search & jump)' },
  { keys: 'Esc', action: 'Close dialogs / menus (when focused)' },
];

/**
 * Global dashboard shortcuts + help modal. Skips shortcuts while typing in inputs or when using modifier chords (except Shift+/).
 */
export function DashboardKeyboardShortcuts({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;
  const goPendingRef = useRef(false);
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGo = useCallback(() => {
    goPendingRef.current = false;
    if (goTimerRef.current) {
      clearTimeout(goTimerRef.current);
      goTimerRef.current = null;
    }
  }, []);

  const openShortcutsModal = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (openRef.current) {
        return;
      }

      if (isTypingContext(e.target)) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        clearGo();
        setOpen(true);
        return;
      }

      if (goPendingRef.current) {
        const k = e.key.toLowerCase();
        if (k === 'd' || k === 'c' || k === 's') {
          e.preventDefault();
          clearGo();
          if (k === 'd') router.push('/');
          else if (k === 'c') router.push('/contracts');
          else router.push('/sponsors');
          return;
        }
        clearGo();
      }

      if (e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault();
        clearGo();
        goPendingRef.current = true;
        goTimerRef.current = setTimeout(() => {
          goPendingRef.current = false;
          goTimerRef.current = null;
        }, GO_WINDOW_MS);
        return;
      }

      if (e.key.toLowerCase() === 'c' && !e.shiftKey) {
        e.preventDefault();
        router.push('/contracts/new');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearGo();
    };
  }, [clearGo, router]);

  return (
    <ShortcutsModalContext.Provider value={{ openShortcutsModal }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md shadow-wf-editorial">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Keyboard shortcuts</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1 font-mono text-xs">?</kbd> anytime (outside text fields) to
              open this panel. Sequences use <kbd className="rounded border bg-muted px-1 font-mono text-xs">g</kbd> then a
              letter within about a second.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 overflow-hidden rounded-md border border-border/60">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/40 font-medium">
                <tr>
                  <th className="px-3 py-2 font-sans">Keys</th>
                  <th className="px-3 py-2 font-sans">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.keys} className="border-b border-border/40 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground">{row.keys}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </ShortcutsModalContext.Provider>
  );
}
