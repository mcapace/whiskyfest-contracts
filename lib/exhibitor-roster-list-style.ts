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

/** Map sheet keys / labels to canonical roster list keys. */
export function normalizeRosterListKey(listKey: string): 'returning' | 'champagne' | 'new' | string {
  const k = listKey.trim().toLowerCase();
  if (k === 'returning' || k.includes('return')) return 'returning';
  if (k === 'champagne' || k.includes('sparkling')) return 'champagne';
  if (k === 'new' || k.includes('new exhib')) return 'new';
  return k;
}

/** Theme palette tokens (brass / whisky / ink) — avoid partial Tailwind amber scale. */
const STYLES: Record<'returning' | 'champagne' | 'new', RosterListStyle> = {
  returning: {
    shortLabel: 'Returning',
    icon: Users,
    badge: 'border-ink-500 bg-ink-300/30 text-ink-900',
    buttonActive: 'border-oak-800 bg-oak-800 text-parchment-50 shadow-sm hover:bg-oak-900',
    buttonIdle: 'border-ink-500 bg-ink-300/25 text-ink-900 hover:bg-ink-300/40',
    rowAccent: 'border-l-4 border-l-ink-500 bg-ink-300/10',
    legendDot: 'bg-ink-500',
  },
  champagne: {
    shortLabel: 'Champagne',
    icon: Sparkles,
    badge: 'border-brass-600 bg-brass-100 text-brass-900',
    buttonActive: 'border-brass-700 bg-brass-600 text-white shadow-sm hover:bg-brass-700',
    buttonIdle: 'border-brass-500 bg-brass-100 text-brass-900 hover:bg-brass-200',
    rowAccent: 'border-l-4 border-l-brass-600 bg-brass-50/90',
    legendDot: 'bg-brass-600',
  },
  new: {
    shortLabel: 'New',
    icon: UserPlus,
    badge: 'border-whisky-600 bg-whisky-100 text-whisky-900',
    buttonActive: 'border-whisky-700 bg-whisky-600 text-white shadow-sm hover:bg-whisky-700',
    buttonIdle: 'border-whisky-500 bg-whisky-100 text-whisky-900 hover:bg-whisky-200',
    rowAccent: 'border-l-4 border-l-whisky-600 bg-whisky-50/90',
    legendDot: 'bg-whisky-600',
  },
};

const FALLBACK: RosterListStyle = {
  shortLabel: 'List',
  icon: Wine,
  badge: 'border-border bg-muted text-foreground',
  buttonActive: 'border-foreground bg-foreground text-background',
  buttonIdle: 'border-border bg-muted/40 text-foreground hover:bg-muted/60',
  rowAccent: 'border-l-4 border-l-border bg-muted/20',
  legendDot: 'bg-muted-foreground',
};

export function rosterListStyle(listKey: RosterListKey): RosterListStyle {
  const key = normalizeRosterListKey(listKey);
  if (key === 'returning' || key === 'champagne' || key === 'new') return STYLES[key];
  return FALLBACK;
}

export function rosterListShortLabel(listKey: RosterListKey, fullLabel?: string): string {
  const key = normalizeRosterListKey(listKey);
  if (key === 'returning' || key === 'champagne' || key === 'new') return STYLES[key].shortLabel;
  return fullLabel?.trim() || FALLBACK.shortLabel;
}

export function rosterListBadgeClass(listKey: RosterListKey): string {
  return cn(
    'inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border px-1.5 text-[10px] font-semibold leading-none whitespace-nowrap',
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
      ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:opacity-95'
      : 'border-border bg-background text-foreground hover:bg-muted';
  }
  const accent = rosterListStyle(listKey);
  return active ? accent.buttonActive : accent.buttonIdle;
}

export function rosterListFilterCountClass(listKey: RosterListKey | 'all', active: boolean): string {
  if (active) return 'bg-black/15 text-inherit';
  const key = listKey === 'all' ? null : normalizeRosterListKey(listKey);
  if (key === 'returning') return 'bg-ink-500/20 text-ink-900';
  if (key === 'champagne') return 'bg-brass-500/25 text-brass-900';
  if (key === 'new') return 'bg-whisky-500/20 text-whisky-900';
  return 'bg-muted text-muted-foreground';
}

export const ROSTER_ALL_LISTS_ICON = LayoutGrid;
