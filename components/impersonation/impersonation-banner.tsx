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
      className="fixed inset-x-0 top-0 z-[60] border-b border-amber-500/40 bg-gradient-to-r from-amber-100 via-amber-50 to-orange-50 px-4 py-2.5 text-amber-950 shadow-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 lg:pl-64 lg:pr-10">
        <p className="text-sm font-medium">
          Viewing as <span className="font-semibold">{label}</span>{' '}
          <span className="text-amber-900/80">({imp.role_description})</span> —{' '}
          <span className="font-semibold">Read-only</span>
        </p>
        <Button type="button" size="sm" variant="outline" className="border-amber-700/40 bg-white/80" onClick={() => void exit()}>
          Exit impersonation
        </Button>
      </div>
    </div>
  );
}
