'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { NYWE_GALLO_ORDER_DEFAULTS, parseCoveredWineries } from '@/lib/nywe-combined-contract';
import type { ContractWithTotals } from '@/types/db';

export function NyweGalloSendBanner({
  contract,
  clientSendEnabled,
}: {
  contract: ContractWithTotals;
  clientSendEnabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wineries = parseCoveredWineries(contract.covered_wineries);
  if (wineries.length < 2) return null;

  const signerName = contract.signer_1_name?.trim() || NYWE_GALLO_ORDER_DEFAULTS.signer_1_name;
  const signerEmail = contract.signer_1_email?.trim() || NYWE_GALLO_ORDER_DEFAULTS.signer_1_email;
  const totalCents = contract.grand_total_cents || wineries.length * contract.booth_rate_cents;

  function sendOrder() {
    const confirmed = window.confirm(
      `Send the Gallo license for ${wineries.length} wineries (${formatCurrency(totalCents)}) to ${signerName} (${signerEmail})?`,
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contract.id}/nywe-client-send`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not send the Gallo contract.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-fest-600/25 bg-fest-50/70 px-5 py-4">
      <p className="text-sm font-semibold text-foreground">Gallo order is ready to send</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {wineries.length} wineries · {formatCurrency(totalCents)}. One DocuSign email to {signerName} ({signerEmail})
        covers this whole order.
      </p>
      <p className="mt-2 text-sm text-foreground">{wineries.map((winery) => winery.winery_name).join(' · ')}</p>
      {clientSendEnabled ? (
        <Button className="mt-3" size="sm" onClick={sendOrder} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send via DocuSign
        </Button>
      ) : (
        <p className="mt-3 text-sm text-amber-900">DocuSign send is turned off for this event. The order is ready when sending is enabled.</p>
      )}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
