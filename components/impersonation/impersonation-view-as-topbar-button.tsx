'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImpersonationPickerDialog } from '@/components/impersonation/impersonation-picker-dialog';
import { cn } from '@/lib/utils';

/** Eye icon in top bar — opens the same user picker as Sidebar → View as… */
export function ImpersonationViewAsTopbarButton() {
  const { data: session } = useSession();
  const canImpersonate = Boolean(session?.user?.can_impersonate);
  const readOnly = Boolean(session?.is_read_only_impersonation);
  const [open, setOpen] = useState(false);

  if (!canImpersonate || readOnly) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'h-9 w-9 shrink-0 text-muted-foreground',
          'hover:bg-muted/80 hover:text-foreground',
        )}
        title="View app as another user"
        aria-label="View app as another user"
        onClick={() => setOpen(true)}
      >
        <Eye className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
      </Button>
      <ImpersonationPickerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
