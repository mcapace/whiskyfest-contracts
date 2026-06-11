import type { LucideIcon } from 'lucide-react';
import { LayoutGrid, Sparkles, UserPlus, Users, Wine } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RosterListKey = 'returning' | 'champagne' | 'new' | string;

type RosterListStyle = {
  shortLabel: string;
  icon: LucideIcon;
  badge: string;
  buttonActive: string;
  buttonIdle: string;
  rowAccent: string;
  legendDot: string;
};

const STYLES: Record<string, RosterListStyle> = {
  returning: {
    shortLabel: 'Returning',
    icon: Users,
    badge: 'border-[#c97888]/70 bg-[#f8ecee] text-[#5c2430] ring-[#e8c4ca]/70',
    buttonActive: 'border-[#7a2f3b] bg-[#7a2f3b] text-white shadow-sm hover:bg-[#652630]',
    buttonIdle: 'border-[#c97888] bg-[#faf0f2] text-[#5c2430] hover:bg-[#f8ecee]',
    rowAccent: 'border-l-4 border-l-[#7a2f3b] bg-[#faf3f4]/90',
    legendDot: 'bg-[#7a2f3b]',
  },
  champagne: {
    shortLabel: 'Champagne',
    icon: Sparkles,
    badge: 'border-amber-400/80 bg-amber-100 text-amber-950 ring-amber-200/60',
    buttonActive: 'border-amber-600 bg-amber-600 text-white shadow-sm hover:bg-amber-700',
    buttonIdle: 'border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100',
    rowAccent: 'border-l-4 border-l-amber-500 bg-amber-50/40',
    legendDot: 'bg-amber-500',
  },
  new: {
    shortLabel: 'New',
    icon: UserPlus,
    badge: 'border-[#8a9a6d]/80 bg-[#eef1e8] text-[#3d4a34] ring-[#d5ddc8]/80',
    buttonActive: 'border-[#6d7d5c] bg-[#6d7d5c] text-white shadow-sm hover:bg-[#5a684d]',
    buttonIdle: 'border-[#8a9a6d] bg-[#f4f6f0] text-[#3d4a34] hover:bg-[#eef1e8]',
    rowAccent: 'border-l-4 border-l-[#8a9a6d] bg-[#f4f6f0]/80',
    legendDot: 'bg-[#8a9a6d]',
  },
};

const FALLBACK: RosterListStyle = {
  shortLabel: 'List',
  icon: Wine,
  badge: 'border-border bg-muted text-foreground',
  buttonActive: 'border-border bg-foreground text-background',
  buttonIdle: 'border-border bg-muted/40 text-foreground hover:bg-muted/60',
  rowAccent: 'border-l-4 border-l-border bg-muted/20',
  legendDot: 'bg-muted-foreground',
};

export function rosterListStyle(listKey: RosterListKey): RosterListStyle {
  return STYLES[listKey] ?? FALLBACK;
}

export function rosterListBadgeClass(listKey: RosterListKey): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
    rosterListStyle(listKey).badge,
  );
}

export function rosterListRowClass(listKey: RosterListKey, showAccent: boolean): string {
  if (!showAccent) return '';
  return rosterListStyle(listKey).rowAccent;
}

export function rosterListIcon(listKey: RosterListKey): LucideIcon {
  return rosterListStyle(listKey).icon;
}

export function rosterListFilterClass(listKey: RosterListKey | 'all', active: boolean): string {
  if (listKey === 'all') {
    return active
      ? 'border-rose-900 bg-rose-900 text-white shadow-sm hover:bg-rose-950'
      : 'border-border bg-muted/30 text-foreground hover:bg-muted/50';
  }
  const accent = rosterListStyle(listKey);
  return active ? accent.buttonActive : accent.buttonIdle;
}

export const ROSTER_ALL_LISTS_ICON = LayoutGrid;
