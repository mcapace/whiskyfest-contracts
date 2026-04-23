/**
 * Design tokens — mirrors CSS variables in `app/globals.css`.
 * Use for programmatic values; prefer Tailwind + CSS vars in components.
 */

export const cssVar = {
  bgPage: 'hsl(var(--bg-page))',
  bgSurface: 'hsl(var(--bg-surface))',
  bgSurfaceRaised: 'hsl(var(--bg-surface-raised))',
  /** Brand accent (timeline nodes, command palette selection) — maps to `--accent-brand`. */
  accentBrand: 'hsl(var(--accent-brand))',
  ringFocus: 'hsl(var(--ring))',
} as const;

export const STORAGE_KEYS = {
  theme: 'wf-theme',
} as const;

export type ThemePreference = 'light' | 'dark' | 'system';
