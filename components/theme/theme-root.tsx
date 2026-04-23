'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { STORAGE_KEYS, type ThemePreference } from '@/lib/design-system';

function parseStored(raw: string | null): ThemePreference | null {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return null;
}

function resolveDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applies `class="dark"` and `data-theme` on `<html>` from localStorage → session → system. */
export function ThemeRoot() {
  const { data: session } = useSession();

  useEffect(() => {
    const apply = () => {
      const ls = parseStored(localStorage.getItem(STORAGE_KEYS.theme));
      const sp = session?.user?.theme_preference;
      const sessionPref =
        sp === 'light' || sp === 'dark' || sp === 'system' ? sp : null;
      const pref: ThemePreference | null = ls ?? sessionPref ?? null;
      const effective: ThemePreference = pref ?? 'system';
      const dark = resolveDark(effective);

      const el = document.documentElement;
      el.classList.toggle('dark', dark);
      el.setAttribute('data-theme', dark ? 'dark' : 'light');

      el.classList.add('wf-theme-transitioning');
      window.setTimeout(() => el.classList.remove('wf-theme-transitioning'), 320);
    };

    apply();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    window.addEventListener('storage', apply);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('storage', apply);
    };
  }, [session?.user?.theme_preference]);

  return null;
}
