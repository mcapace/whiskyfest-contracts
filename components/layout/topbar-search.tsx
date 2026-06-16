'use client';

import { Search } from 'lucide-react';
import { useCommandPalette } from '@/components/command-palette/command-palette';

export function TopbarSearch() {
  const { setOpen } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="hidden min-w-[12rem] max-w-md flex-1 items-center gap-2 rounded-lg border border-border/60 bg-white/80 px-3 py-2 text-left text-sm text-muted-foreground shadow-sm transition hover:border-border hover:bg-white md:flex lg:min-w-[16rem]"
      aria-label="Search contracts and navigation"
    >
      <Search className="h-4 w-4 shrink-0 opacity-60" />
      <span className="flex-1 truncate">Search…</span>
      <kbd className="hidden rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
        ⌘K
      </kbd>
    </button>
  );
}
