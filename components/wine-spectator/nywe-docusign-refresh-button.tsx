'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type RefreshSummary = {
  winerySigned: number;
  fullySigned: number;
  releasedToAccounting: number;
  unchanged: number;
  errors: number;
  remainingSent: number;
  hasMore: boolean;
};

function formatSummary(summary: RefreshSummary): string {
  const parts: string[] = [];
  if (summary.winerySigned > 0) {
    parts.push(`${summary.winerySigned} winery signature${summary.winerySigned === 1 ? '' : 's'} synced`);
  }
  if (summary.fullySigned > 0) {
    parts.push(`${summary.fullySigned} fully signed`);
  }
  if (summary.releasedToAccounting > 0) {
    parts.push(`${summary.releasedToAccounting} released to accounting`);
  }
  if (parts.length === 0) {
    parts.push('Everything is already up to date');
  }
  if (summary.errors > 0) {
    parts.push(`${summary.errors} error${summary.errors === 1 ? '' : 's'}`);
  }
  if (summary.hasMore && summary.remainingSent > 0) {
    parts.push(`${summary.remainingSent} sent contract${summary.remainingSent === 1 ? '' : 's'} still to check — run again`);
  }
  return parts.join(' · ');
}

export function NyweDocuSignRefreshButton({
  className,
  variant = 'outline',
  size = 'sm',
  full = true,
}: {
  className?: string;
  variant?: 'outline' | 'secondary' | 'ghost';
  size?: 'sm' | 'default';
  full?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    setMessage(null);
    startTransition(async () => {
      try {
        const params = new URLSearchParams();
        if (full) params.set('all', '1');
        const res = await fetch(`/api/wine-spectator/sync-docusign-signatures?${params}`, { method: 'POST' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(typeof json.error === 'string' ? json.error : 'Refresh failed — try again.');
          return;
        }
        const summary = json.summary as RefreshSummary | undefined;
        setMessage(summary ? formatSummary(summary) : 'DocuSign refresh complete.');
        router.refresh();
      } catch {
        setMessage('Refresh failed — check your connection and try again.');
      }
    });
  }, [full, router]);

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={refresh}
        disabled={pending}
        className="gap-2"
      >
        <RefreshCw className={cn('h-4 w-4', pending && 'animate-spin')} aria-hidden />
        {pending ? 'Refreshing from DocuSign…' : 'Refresh from DocuSign'}
      </Button>
      {message ? <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{message}</p> : null}
    </div>
  );
}
