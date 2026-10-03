'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { summarizeGalloForDashboard, type GalloDashboardSummary } from '@/lib/nywe-combined-contract';
import type { ContractWithTotals, Event } from '@/types/db';

type LoadedSummary = {
  eventId: string;
  feeCents: number;
  summary: GalloDashboardSummary;
};

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
  const [loaded, setLoaded] = useState<LoadedSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fallback =
    event != null
      ? (() => {
          const summary = summarizeGalloForDashboard(
            contracts,
            event.id,
            event.booth_rate_cents ?? 1_400_000,
          );
          return summary
            ? { eventId: event.id, feeCents: event.booth_rate_cents ?? 1_400_000, summary }
            : null;
        })()
      : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(`/api/wine-spectator/gallo-contract${event?.id ? `?eventId=${encodeURIComponent(event.id)}` : ''}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.summary && typeof json.eventId === 'string') {
          setLoaded({
            eventId: json.eventId,
            feeCents: typeof json.feeCents === 'number' ? json.feeCents : 1_400_000,
            summary: json.summary as GalloDashboardSummary,
          });
        } else {
          setLoaded(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event?.id]);

  const payload = loaded ?? fallback;
  if (!payload) {
    if (loading) {
      return (
        <div className="rounded-xl border border-border/60 bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
          Checking Gallo licenses…
        </div>
      );
    }
    return null;
  }

  const { summary, eventId } = payload;

  function openReadyOrder(voidSent: boolean) {
    if (voidSent) {
      const names = summary.sent.map((row) => row.wineryName).join(', ') || summary.wineryNames.join(', ');
      const confirmed = window.confirm(
        `Void the DocuSign envelopes for the separate Gallo licenses (${names}), then open one combined order for ${summary.wineryNames.length} wineries (${formatCurrency(summary.totalCents)})?`,
      );
      if (!confirmed) return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/wine-spectator/gallo-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, voidSent }),
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
    <div
      className={
        summary.needsVoid
          ? 'rounded-xl border border-amber-300/80 bg-amber-50/95 px-5 py-4'
          : 'rounded-xl border border-fest-600/20 bg-fest-50/50 px-5 py-4'
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Gallo — one contract</p>
          {summary.needsVoid ? (
            <p className="mt-1 text-sm text-amber-950/90">
              Separate Gallo licenses were already sent. Void those DocuSign envelopes and create one order for{' '}
              {summary.wineryNames.length} wineries, total {formatCurrency(summary.totalCents)}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              One order for {summary.wineryNames.length} wineries, total {formatCurrency(summary.totalCents)}. Open it
              and click Send via DocuSign.
            </p>
          )}
          <p className="mt-2 text-sm text-foreground">{summary.wineryNames.join(' · ')}</p>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={() => openReadyOrder(summary.needsVoid)} disabled={pending || loading}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {summary.needsVoid ? 'Void sent & open to send' : 'Open to send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
