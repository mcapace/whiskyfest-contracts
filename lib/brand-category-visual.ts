import type { LucideIcon } from 'lucide-react';
import {
  Anchor,
  Cherry,
  Clover,
  Crown,
  Flame,
  Globe2,
  Layers,
  Leaf,
  Snowflake,
  Sun,
  Wheat,
  Wine,
} from 'lucide-react';
import type { BrandCategory } from '@/lib/brand-category';

export type BrandCategoryVisual = {
  Icon: LucideIcon;
  /** Progress bar fill */
  bar: string;
  /** Icon badge (ring + bg + icon color) */
  badge: string;
  /** Optional track tint behind the bar */
  track: string;
};

export const BRAND_CATEGORY_VISUAL: Record<BrandCategory, BrandCategoryVisual> = {
  Bourbon: {
    Icon: Wine,
    bar: 'bg-amber-600',
    badge: 'bg-amber-100/80 text-amber-800 ring-amber-300/40',
    track: 'bg-amber-100/50',
  },
  Scotch: {
    Icon: Crown,
    bar: 'bg-whisky-600',
    badge: 'bg-whisky-100/90 text-whisky-800 ring-whisky-300/40',
    track: 'bg-whisky-100/50',
  },
  Irish: {
    Icon: Clover,
    bar: 'bg-emerald-600',
    badge: 'bg-emerald-100/80 text-emerald-800 ring-emerald-300/40',
    track: 'bg-emerald-100/50',
  },
  Japanese: {
    Icon: Cherry,
    bar: 'bg-rose-600',
    badge: 'bg-rose-100/80 text-rose-800 ring-rose-300/40',
    track: 'bg-rose-100/50',
  },
  Rye: {
    Icon: Wheat,
    bar: 'bg-orange-600',
    badge: 'bg-orange-100/80 text-orange-800 ring-orange-300/40',
    track: 'bg-orange-100/50',
  },
  'World Whiskies': {
    Icon: Globe2,
    bar: 'bg-fest-600',
    badge: 'bg-fest-100/90 text-fest-800 ring-fest-300/40',
    track: 'bg-fest-100/50',
  },
  Tequila: {
    Icon: Sun,
    bar: 'bg-lime-600',
    badge: 'bg-lime-100/80 text-lime-800 ring-lime-300/40',
    track: 'bg-lime-100/50',
  },
  Vodka: {
    Icon: Snowflake,
    bar: 'bg-sky-500',
    badge: 'bg-sky-100/80 text-sky-800 ring-sky-300/40',
    track: 'bg-sky-100/50',
  },
  Gin: {
    Icon: Leaf,
    bar: 'bg-teal-600',
    badge: 'bg-teal-100/80 text-teal-800 ring-teal-300/40',
    track: 'bg-teal-100/50',
  },
  Rum: {
    Icon: Anchor,
    bar: 'bg-copper-600',
    badge: 'bg-brass-100/80 text-copper-600 ring-brass-300/40',
    track: 'bg-brass-100/50',
  },
  Cigar: {
    Icon: Flame,
    bar: 'bg-stone-600',
    badge: 'bg-stone-200/80 text-stone-800 ring-stone-400/40',
    track: 'bg-stone-200/50',
  },
  Other: {
    Icon: Layers,
    bar: 'bg-ink-300',
    badge: 'bg-parchment-200/80 text-ink-700 ring-parchment-300/60',
    track: 'bg-parchment-100',
  },
};

export function getBrandCategoryVisual(name: string): BrandCategoryVisual {
  if (name in BRAND_CATEGORY_VISUAL) {
    return BRAND_CATEGORY_VISUAL[name as BrandCategory];
  }
  return BRAND_CATEGORY_VISUAL.Other;
}
