'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { summarizeGalloForDashboard } from '@/lib/nywe-combined-contract';
import type { ContractWithTotals, Event } from '@/types/db';

export function NyweGalloCombineCard({
  contracts,
  event,
  portalBasePath = '/wine-spectator',
}: {
  contracts: ContractWithTotals[];
  event: Pick<Event, 'id' | 'booth_rate_cents'> | null;
  portalBasePath?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!event) return null;
  const eventId = event.id;
  const summary = summarizeGalloForDashboard(contracts, eventId, event.booth_rate_cents ?? 1_400_000);
  if (!summary) return null;

  const href = summary.combinedContractId
    ? `${portalBasePath}/contracts/${summary.combinedContractId}`
    : null;

  function createCombinedContract() {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/wine-spectator/gallo-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.contractId !== 'string') {
        setError(typeof json.error === 'string' ? json.error : 'Could not create the Gallo contract.');
        return;
      }
      router.push(`${portalBasePath}/contracts/${json.contractId}`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-fest-600/20 bg-fest-50/50 px-5 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Gallo — one contract</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.alreadyCombined
              ? `${summary.wineryNames.length} wineries are already on one license.`
              : `${summary.unsent.length} separate licenses can be combined into one.`}{' '}
            Total {formatCurrency(summary.totalCents)} ({summary.wineryNames.length} ×{' '}
            {formatCurrency(summary.feeCents)}).
          </p>
          <p className="mt-2 text-sm text-foreground">{summary.wineryNames.join(' · ')}</p>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {summary.alreadyCombined && href ? (
            <Button size="sm" onClick={() => router.push(href)}>
              Open to send
            </Button>
          ) : (
            <Button size="sm" onClick={createCombinedContract} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Create one Gallo contract
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
