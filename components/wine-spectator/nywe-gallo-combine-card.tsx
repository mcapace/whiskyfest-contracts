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

  function openReadyOrder() {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/wine-spectator/gallo-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || typeof json.contractId !== 'string') {
        setError(typeof json.error === 'string' ? json.error : 'Could not prepare the Gallo order.');
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
            One order for {summary.wineryNames.length} wineries, total {formatCurrency(summary.totalCents)}. Open it
            and click Send via DocuSign.
          </p>
          <p className="mt-2 text-sm text-foreground">{summary.wineryNames.join(' · ')}</p>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={openReadyOrder} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Open to send
          </Button>
        </div>
      </div>
    </div>
  );
}
