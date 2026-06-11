import { cn } from '@/lib/utils';

export type RosterListKey = 'returning' | 'champagne' | 'new' | string;

type RosterListStyle = {
  shortLabel: string;
  badge: string;
  buttonActive: string;
  buttonIdle: string;
  rowAccent: string;
  legendDot: string;
};

const STYLES: Record<string, RosterListStyle> = {
  returning: {
    shortLabel: 'Returning',
    badge: 'border-rose-300/80 bg-rose-100 text-rose-950 ring-rose-200/60',
    buttonActive: 'border-rose-700 bg-rose-700 text-white hover:bg-rose-800',
    buttonIdle: 'border-rose-300/80 bg-rose-50/80 text-rose-900 hover:bg-rose-100',
    rowAccent: 'border-l-4 border-l-rose-500 bg-rose-50/35',
    legendDot: 'bg-rose-600',
  },
  champagne: {
    shortLabel: 'Champagne',
    badge: 'border-amber-300/80 bg-amber-100 text-amber-950 ring-amber-200/60',
    buttonActive: 'border-amber-600 bg-amber-600 text-white hover:bg-amber-700',
    buttonIdle: 'border-amber-300/80 bg-amber-50/90 text-amber-950 hover:bg-amber-100',
    rowAccent: 'border-l-4 border-l-amber-500 bg-amber-50/40',
    legendDot: 'bg-amber-500',
  },
  new: {
    shortLabel: 'New',
    badge: 'border-emerald-300/80 bg-emerald-100 text-emerald-950 ring-emerald-200/60',
    buttonActive: 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800',
    buttonIdle: 'border-emerald-300/80 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100',
    rowAccent: 'border-l-4 border-l-emerald-500 bg-emerald-50/35',
    legendDot: 'bg-emerald-600',
  },
};

const FALLBACK: RosterListStyle = {
  shortLabel: 'List',
  badge: 'border-border bg-muted text-foreground',
  buttonActive: '',
  buttonIdle: '',
  rowAccent: 'border-l-4 border-l-border bg-muted/20',
  legendDot: 'bg-muted-foreground',
};

export function rosterListStyle(listKey: RosterListKey): RosterListStyle {
  return STYLES[listKey] ?? FALLBACK;
}

export function rosterListBadgeClass(listKey: RosterListKey): string {
  return cn(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
    rosterListStyle(listKey).badge,
  );
}

export function rosterListRowClass(listKey: RosterListKey, showAccent: boolean): string {
  if (!showAccent) return '';
  return rosterListStyle(listKey).rowAccent;
}
