'use client';

import { useCallback, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Send, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="space-y-4">
      {reviewCount > 0 ? (
        <section className="rounded-xl border-2 border-sky-400/60 bg-sky-50 p-6 shadow-sm">
          <p className="text-lg font-semibold text-sky-950">
            {reviewCount} license{reviewCount === 1 ? '' : 's'} need{reviewCount === 1 ? 's' : ''} your approval
          </p>
          <p className="mt-2 text-base text-sky-900/90">
            Open the license, check the PDF, and click <strong>Approve</strong>.
          </p>
          <Button asChild size="lg" className="mt-4 h-12 px-8 text-base">
            <Link href="/wine-spectator/contracts?status=pending_events_review">Review now</Link>
          </Button>
        </section>
      ) : null}

      {readyToCountersign.length > 0 ? (
        <section className="rounded-xl border-2 border-orange-500 bg-orange-50 p-6 shadow-sm">
          <p className="flex items-start gap-2 text-lg font-semibold text-orange-950">
            <PenLine className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {readyToCountersign.length === 1
              ? 'One winery signed — countersign in DocuSign'
              : `${readyToCountersign.length} wineries signed — countersign in DocuSign`}
          </p>
          <p className="mt-2 text-base text-orange-900/90">
            Open the DocuSign email in your inbox for each license below. After you countersign, accounting is notified
            automatically.
          </p>
          <ul className="mt-4 space-y-3">
            {readyToCountersign.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-orange-400/40 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">{row.exhibitorCompanyName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(row.grandTotalCents)} · signed{' '}
                    <RelativeTime iso={row.updatedAt} />
                  </p>
                </div>
                <Link
                  href={`/wine-spectator/contracts/${row.id}`}
                  className="text-sm font-medium text-accent-brand hover:underline"
                >
                  View license
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {waitingOnWineryCount > 0 ? (
        <section className="rounded-xl border border-emerald-300/70 bg-emerald-50/80 p-5">
          <p className="flex items-center gap-2 text-base font-medium text-emerald-950">
            <Send className="h-5 w-5 shrink-0" aria-hidden />
            {waitingOnWineryCount} waiting on the winery to sign — nothing for you to do yet
          </p>
        </section>
      ) : null}

      {stuck.length > 0 ? (
        <section className="rounded-xl border-2 border-amber-500 bg-amber-50 p-6 shadow-sm">
          <p className="flex items-start gap-2 text-lg font-semibold text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            {stuck.length === 1
              ? 'One license needs a quick tap to reach accounting'
              : `${stuck.length} licenses need a quick tap to reach accounting`}
          </p>
          <p className="mt-2 text-base text-amber-900/90">
            You already signed these in DocuSign. Tap the button below and we&apos;ll send them to Danielle&apos;s team.
          </p>
          <ul className="mt-4 space-y-3">
            {stuck.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 rounded-lg border border-amber-400/40 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">{row.exhibitorCompanyName}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(row.grandTotalCents)}</p>
                </div>
                {canFixStuck ? (
                  <Button
                    size="lg"
                    className="h-12 shrink-0 px-6 text-base"
                    disabled={pending}
                    onClick={() => fixStuck(row.id)}
                  >
                    {pending && pendingId === row.id ? 'Sending…' : 'Send to accounting'}
                  </Button>
                ) : (
                  <Link href={`/wine-spectator/contracts/${row.id}`} className="text-sm font-medium text-accent-brand hover:underline">
                    Open license
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border border-emerald-400/50 bg-emerald-50/90 p-6">
          <p className="flex items-start gap-2 text-lg font-semibold text-emerald-950">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            You&apos;re all caught up on accounting
          </p>
          <p className="mt-2 text-base leading-relaxed text-emerald-900/90">
            When you countersign a license in DocuSign, it goes to Danielle&apos;s team automatically. You don&apos;t need
            to do anything else in this app for invoicing.
          </p>
        </section>
      )}

      {recentlySent.length > 0 ? (
        <section className="rounded-lg border border-border/60 bg-white p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recently sent to accounting</p>
          <ul className="mt-3 divide-y divide-border/50">
            {recentlySent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.exhibitorCompanyName}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.executedAt ? <RelativeTime iso={row.executedAt} /> : 'Sent recently'}
                  </p>
                </div>
                <p className="shrink-0 tabular-nums text-sm font-medium">{formatCurrency(row.grandTotalCents)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
