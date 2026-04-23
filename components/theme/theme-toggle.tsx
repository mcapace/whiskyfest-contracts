'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Moon, Sun } from 'lucide-react';
import { STORAGE_KEYS } from '@/lib/design-system';

export function ThemeToggle() {
  const { update } = useSession();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  async function toggle() {
    const nextDark = !document.documentElement.classList.contains('dark');
    const pref = nextDark ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEYS.theme, pref);
    await update({ themePreference: pref });
    document.documentElement.classList.toggle('dark', nextDark);
    document.documentElement.setAttribute('data-theme', nextDark ? 'dark' : 'light');
    setDark(nextDark);
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className="rounded-full border border-border/60 bg-bg-surface p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground motion-safe:active:scale-[0.96]"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="h-4 w-4" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
    </button>
  );
}
