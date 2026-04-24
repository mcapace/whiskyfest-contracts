'use client';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { CommandPaletteTrigger } from '@/components/command-palette/command-palette';
import { HelpMenu } from '@/components/help-menu';
import { ImpersonationViewAsTopbarButton } from '@/components/impersonation/impersonation-view-as-topbar-button';

export function DashboardTopBarActions() {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <ImpersonationViewAsTopbarButton />
      <HelpMenu />
      <ThemeToggle />
      <CommandPaletteTrigger />
    </div>
  );
}
