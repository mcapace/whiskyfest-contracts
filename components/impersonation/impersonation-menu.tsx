'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Eye } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ImpersonationPickerDialog } from '@/components/impersonation/impersonation-picker-dialog';

export function ImpersonationMenu({ canImpersonate }: { canImpersonate: boolean }) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(false);

  const readOnly = Boolean(session?.is_read_only_impersonation);

  async function exit() {
    await update({ impersonationClear: true });
    router.refresh();
  }

  if (!canImpersonate) return null;

  return (
    <>
      <DropdownMenuItem
        data-tour="impersonation-menu"
        onSelect={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        <Eye className="mr-2 h-4 w-4" />
        View as…
      </DropdownMenuItem>
      {readOnly ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              void exit();
            }}
          >
            Exit impersonation
          </DropdownMenuItem>
        </>
      ) : null}

      <ImpersonationPickerDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
