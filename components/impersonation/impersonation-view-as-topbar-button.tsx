'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImpersonationPickerDialog } from '@/components/impersonation/impersonation-picker-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const VIEW_AS_TOOLTIP = 'View app as another user (read-only)';

/** Eye icon in top bar — opens the same user picker as Sidebar → View as… */
export function ImpersonationViewAsTopbarButton() {
  const { data: session } = useSession();
  const canImpersonate = Boolean(session?.user?.can_impersonate);
  const readOnly = Boolean(session?.is_read_only_impersonation);
  const [open, setOpen] = useState(false);

  if (!canImpersonate || readOnly) return null;

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              'h-9 w-9 shrink-0 border-border/80 text-muted-foreground',
              'hover:bg-muted/80 hover:text-foreground',
            )}
            title={VIEW_AS_TOOLTIP}
            aria-label={VIEW_AS_TOOLTIP}
            onClick={() => setOpen(true)}
          >
            <Eye className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{VIEW_AS_TOOLTIP}</p>
        </TooltipContent>
      </Tooltip>
      <ImpersonationPickerDialog open={open} onOpenChange={setOpen} />
    </TooltipProvider>
  );
}
