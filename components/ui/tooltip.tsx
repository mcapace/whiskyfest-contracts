'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[60] max-w-[280px] rounded-lg border border-primary/25 bg-card px-3 py-2.5 text-sm leading-snug text-foreground shadow-wf-floating',
        'data-[state=delayed-open]:motion-safe:animate-in data-[state=delayed-open]:motion-safe:fade-in-0 data-[state=delayed-open]:motion-safe:zoom-in-95 data-[state=delayed-open]:motion-safe:duration-150',
        'data-[state=closed]:motion-safe:animate-out data-[state=closed]:motion-safe:fade-out-0 data-[state=closed]:motion-safe:zoom-out-95 data-[state=closed]:motion-safe:duration-100',
        'motion-reduce:data-[state=delayed-open]:animate-none motion-reduce:data-[state=closed]:animate-none',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
