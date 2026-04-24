'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const imp = session?.impersonation;

  if (!imp?.active) return null;

  const label = imp.target_name?.trim() || imp.target_email;

  async function exit() {
    await update({ impersonationClear: true });
    router.refresh();
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] border-b-2 border-amber-600 bg-amber-400 px-4 py-3 text-amber-950 shadow-md dark:border-amber-500 dark:bg-amber-500 dark:text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 lg:pl-64 lg:pr-10">
        <p className="text-base font-semibold leading-snug">
          Viewing as <span className="font-extrabold tracking-tight">{label}</span>
          <span className="mx-1.5 font-medium opacity-90">—</span>
          <span className="text-sm font-bold uppercase tracking-wide text-amber-950/90 dark:text-amber-950">
            Read-only
          </span>
          <span className="mt-0.5 block text-sm font-medium opacity-90">({imp.role_description})</span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0 border-2 border-amber-900/30 bg-white font-bold text-amber-950 shadow-sm hover:bg-amber-50 dark:border-amber-950/40 dark:bg-amber-100 dark:hover:bg-white"
          onClick={() => void exit()}
          title="Exit impersonation and return to your account"
        >
          End
        </Button>
      </div>
    </div>
  );
}
