'use client';

import type { ReactNode } from 'react';
import { useCallback, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, PenLine, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { emitContractActionSuccessFeedback } from '@/lib/contract-action-feedback';
import { useSession } from 'next-auth/react';

export type NyweStuckLicense = {
  id: string;
  exhibitorCompanyName: string;
  grandTotalCents: number;
};

export type NyweSentLicense = {
  id: string;
  exhibitorCompanyName: string;
  grandTotalCents: number;
  executedAt: string | null;
};

export type NyweReadyToCountersignLicense = {
  id: string;
  exhibitorCompanyName: string;
  grandTotalCents: number;
  updatedAt: string;
};

type Props = {
  stuck: NyweStuckLicense[];
  recentlySent: NyweSentLicense[];
  reviewCount: number;
  waitingOnWineryCount: number;
  readyToCountersign: NyweReadyToCountersignLicense[];
  canFixStuck: boolean;
};

function QueueRow({
  title,
  subtitle,
  href,
  amount,
}: {
  title: string;
  subtitle: ReactNode;
  href: string;
  amount?: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {typeof amount === 'number' ? (
          <span className="text-sm tabular-nums text-muted-foreground">{formatCurrency(amount)}</span>
        ) : null}
        <Link href={href} className="text-xs font-medium text-accent-brand hover:underline">
          Open
        </Link>
      </div>
    </li>
  );
}

export function NyweSusannahDashboard({
  stuck,
  recentlySent,
  reviewCount,
  waitingOnWineryCount,
  readyToCountersign,
  canFixStuck,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fixStuck = useCallback(
    (contractId: string) => {
      setPendingId(contractId);
      startTransition(async () => {
        const res = await fetch(`/api/contracts/${contractId}/release`, { method: 'POST' });
        if (res.ok) {
          emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
          router.refresh();
        } else {
          const j = await res.json().catch(() => ({}));
          alert(`Something went wrong. Please ask Mike for help.\n\n${j.error ?? res.status}`);
        }
        setPendingId(null);
      });
    },
    [router, session?.user?.sound_enabled],
  );

  const hasQueue =
    reviewCount > 0 || readyToCountersign.length > 0 || stuck.length > 0 || waitingOnWineryCount > 0;

  return (
    <Card className="h-full border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-xl font-medium">Your action queue</CardTitle>
        <p className="text-sm text-muted-foreground">What needs attention right now</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasQueue ? (
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-950">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              All caught up
            </p>
            <p className="mt-1 text-sm text-emerald-900/80">
              Countersign in DocuSign when wineries sign — accounting runs automatically after that.
            </p>
          </div>
        ) : null}

        {readyToCountersign.length > 0 ? (
          <section>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-800">
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              Countersign in DocuSign ({readyToCountersign.length})
            </p>
            <ul className="space-y-2">
              {readyToCountersign.slice(0, 5).map((row) => (
                <QueueRow
                  key={row.id}
                  title={row.exhibitorCompanyName}
                  subtitle={`Winery signed ${new Date(row.updatedAt).toLocaleDateString()}`}
                  href={`/wine-spectator/contracts/${row.id}`}
                  amount={row.grandTotalCents}
                />
              ))}
            </ul>
            {readyToCountersign.length > 5 ? (
              <Link href="/wine-spectator/roster?filter=countersign" className="mt-2 inline-block text-xs font-medium text-accent-brand hover:underline">
                View all {readyToCountersign.length} on roster
              </Link>
            ) : null}
          </section>
        ) : null}

        {reviewCount > 0 ? (
          <section className="rounded-xl border border-sky-200 bg-sky-50/80 p-4">
            <p className="text-sm font-medium text-sky-950">
              {reviewCount} contract{reviewCount === 1 ? '' : 's'} awaiting approval
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link href="/wine-spectator/contracts?status=pending_events_review">Review now</Link>
            </Button>
          </section>
        ) : null}

        {stuck.length > 0 ? (
          <section>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Release to accounting ({stuck.length})
            </p>
            <ul className="space-y-2">
              {stuck.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{row.exhibitorCompanyName}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(row.grandTotalCents)}</p>
                  </div>
                  {canFixStuck ? (
                    <Button size="sm" disabled={pending} onClick={() => fixStuck(row.id)}>
                      {pending && pendingId === row.id ? 'Sending…' : 'Send to accounting'}
                    </Button>
                  ) : (
                    <Link href={`/wine-spectator/contracts/${row.id}`} className="text-xs font-medium text-accent-brand hover:underline">
                      Open
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {waitingOnWineryCount > 0 && readyToCountersign.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Send className="h-4 w-4 shrink-0" aria-hidden />
            {waitingOnWineryCount} waiting on winery signature in DocuSign
          </p>
        ) : null}

        {recentlySent.length > 0 ? (
          <section className="border-t border-border/50 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recently executed</p>
            <ul className="mt-2 space-y-2">
              {recentlySent.slice(0, 4).map((row) => (
                <QueueRow
                  key={row.id}
                  title={row.exhibitorCompanyName}
                  subtitle={row.executedAt ? <RelativeTime iso={row.executedAt} /> : 'Recently'}
                  href={`/wine-spectator/contracts/${row.id}`}
                  amount={row.grandTotalCents}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
