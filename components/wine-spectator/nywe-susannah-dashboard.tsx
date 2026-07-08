'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';

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

type Props = {
  stuck: NyweStuckLicense[];
  recentlySent: NyweSentLicense[];
  reviewCount: number;
  waitingOnWineryCount: number;
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
}: Props) {
  const hasQueue = reviewCount > 0 || stuck.length > 0 || waitingOnWineryCount > 0;

  return (
    <Card className="h-full border-fest-600/15">
      <CardHeader className="pb-4">
        <CardTitle className="font-serif text-lg font-semibold">Your action queue</CardTitle>
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
              Wineries sign in DocuSign — contracts execute and accounting is notified automatically.
            </p>
          </div>
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
              Processing to accounting ({stuck.length})
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              These signed licenses are finishing automatically — no action needed.
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
                  <Link href={`/wine-spectator/contracts/${row.id}`} className="text-xs font-medium text-accent-brand hover:underline">
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {waitingOnWineryCount > 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Send className="h-4 w-4 shrink-0" aria-hidden />
            {waitingOnWineryCount} license{waitingOnWineryCount === 1 ? '' : 's'} waiting on winery signature in DocuSign
          </p>
        ) : null}

        {recentlySent.length > 0 ? (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recently executed
            </p>
            <ul className="space-y-2">
              {recentlySent.slice(0, 5).map((row) => (
                <QueueRow
                  key={row.id}
                  title={row.exhibitorCompanyName}
                  subtitle={
                    row.executedAt ? (
                      <>
                        Executed <RelativeTime iso={row.executedAt} />
                      </>
                    ) : (
                      'Executed'
                    )
                  }
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
