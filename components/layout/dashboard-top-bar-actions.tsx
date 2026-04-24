'use client';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { CommandPaletteTrigger } from '@/components/command-palette/command-palette';
import { HelpMenu } from '@/components/help-menu';

export function DashboardTopBarActions() {
  return (
    <div className="flex items-center gap-2">
      <HelpMenu />
      <ThemeToggle />
      <CommandPaletteTrigger />
    </div>
  );
}
