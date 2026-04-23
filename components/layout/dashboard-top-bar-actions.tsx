'use client';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { CommandPaletteTrigger } from '@/components/command-palette/command-palette';

export function DashboardTopBarActions() {
  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <CommandPaletteTrigger />
    </div>
  );
}
