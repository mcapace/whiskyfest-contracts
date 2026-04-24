'use client';

import * as React from 'react';
import { HelpCircle } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Primary action button(s) plus a small help trigger; tooltip explains when to use the action.
 * Help icon sits immediately after the control, aligned on the baseline row.
 */
export function ActionWithHelp({
  helpText,
  children,
  className,
}: {
  helpText: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex items-baseline gap-0.5', className)}>
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative top-[0.12em] inline-flex shrink-0 rounded-full p-0.5 text-muted-foreground',
              'transition-colors hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
            )}
            aria-label="Help"
          >
            <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" className="whitespace-normal">
          {helpText}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
