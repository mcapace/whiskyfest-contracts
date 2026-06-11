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
    badge: 'border-slate-300 bg-slate-50 text-slate-800',
    buttonActive: 'border-slate-700 bg-slate-700 text-white shadow-sm hover:bg-slate-800',
    buttonIdle: 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
    rowAccent: 'border-l-4 border-l-slate-500 bg-slate-50/70',
    legendDot: 'bg-slate-500',
  },
  champagne: {
    shortLabel: 'Champagne',
    icon: Sparkles,
    badge: 'border-amber-300 bg-amber-50 text-amber-950',
    buttonActive: 'border-amber-700 bg-amber-700 text-white shadow-sm hover:bg-amber-800',
    buttonIdle: 'border-amber-300 bg-white text-amber-950 hover:bg-amber-50',
    rowAccent: 'border-l-4 border-l-amber-600 bg-amber-50/50',
    legendDot: 'bg-amber-600',
  },
  new: {
    shortLabel: 'New',
    icon: UserPlus,
    badge: 'border-rose-300 bg-rose-50 text-rose-950',
    buttonActive: 'border-rose-800 bg-rose-800 text-white shadow-sm hover:bg-rose-900',
    buttonIdle: 'border-rose-300 bg-white text-rose-950 hover:bg-rose-50',
    rowAccent: 'border-l-4 border-l-rose-700 bg-rose-50/50',
    legendDot: 'bg-rose-700',
  },
};

const FALLBACK: RosterListStyle = {
  shortLabel: 'List',
  icon: Wine,
  badge: 'border-border bg-muted text-foreground',
  buttonActive: 'border-foreground bg-foreground text-background',
  buttonIdle: 'border-border bg-white text-foreground hover:bg-muted/40',
  rowAccent: 'border-l-4 border-l-border bg-muted/20',
  legendDot: 'bg-muted-foreground',
};

export function rosterListStyle(listKey: RosterListKey): RosterListStyle {
  return STYLES[listKey] ?? FALLBACK;
}

export function rosterListShortLabel(listKey: RosterListKey, fullLabel?: string): string {
  const style = rosterListStyle(listKey);
  if (STYLES[listKey]) return style.shortLabel;
  return fullLabel?.trim() || style.shortLabel;
}

export function rosterListBadgeClass(listKey: RosterListKey): string {
  return cn(
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
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
      ? 'border-slate-800 bg-slate-800 text-white shadow-sm hover:bg-slate-900'
      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
  }
  const accent = rosterListStyle(listKey);
  return active ? accent.buttonActive : accent.buttonIdle;
}

export function rosterListFilterCountClass(active: boolean): string {
  return active
    ? 'bg-white/20 text-white'
    : 'bg-slate-200/90 text-slate-800';
}

export const ROSTER_ALL_LISTS_ICON = LayoutGrid;
