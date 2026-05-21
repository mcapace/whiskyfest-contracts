'use client';

import * as React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Wraps a control with a tooltip (help text on hover/focus).
 * No separate help icon — keeps the action bar visually clean.
 */
export function ActionWithHelp({
  helpText,
  children,
  className,
}: {
  helpText: string;
  children: React.ReactElement;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex', className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" className="max-w-xs whitespace-normal text-xs leading-snug">
        {helpText}
      </TooltipContent>
    </Tooltip>
  );
}
