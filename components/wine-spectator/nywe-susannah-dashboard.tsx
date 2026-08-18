'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Send, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { RelativeTime } from '@/components/ui/relative-time';
import { NyweBoothQrBookButton } from '@/components/wine-spectator/nywe-booth-qr-book-button';
import { NyweBoothQrRowDownload } from '@/components/wine-spectator/nywe-booth-qr-row-download';

export type NyweStuckLicense = {
  id: string;
  exhibitorCompanyName: string;
  legalName?: string | null;
  signerName?: string | null;
  grandTotalCents: number;
};

export type NyweSentLicense = {
  id: string;
  exhibitorCompanyName: string;
  legalName?: string | null;
  signerName?: string | null;
  grandTotalCents: number;
  executedAt: string | null;
  websiteUrl?: string | null;
};

type QueueItem = {
  id: string;
  exhibitorCompanyName: string;
  legalName?: string | null;
  signerName?: string | null;
  grandTotalCents: number;
  websiteUrl?: string | null;
};

type QrScanRow = {
  id: string;
  exhibitorCompanyName: string;
  shortUrl: string | null;
  clicks: number;
  lastClickAt: string | null;
  websiteUrl?: string | null;
};

type Props = {
  stuck: NyweStuckLicense[];
  recentlySent: NyweSentLicense[];
  reviewQueue: QueueItem[];
  waitingQueue: QueueItem[];
  missingWebsite: QueueItem[];
  qrScans: QrScanRow[];
  reviewCount: number;
  waitingOnWineryCount: number;
  executedBoothCount: number;
  qrReadyCount: number;
  qrGeneratedCount: number;
  eventYear: number;
};

function QueueRow({
  title,
  subtitle,
  href,
  amount,
  qr,
}: {
  title: string;
  subtitle: ReactNode;
  href: string;
  amount?: number;
  qr?: { contractId: string; exhibitorName: string; websiteUrl: string | null };
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3">
        {typeof amount === 'number' ? (
          <span className="text-sm tabular-nums text-muted-foreground">{formatCurrency(amount)}</span>
        ) : null}
        {qr ? (
          <NyweBoothQrRowDownload
            contractId={qr.contractId}
            exhibitorName={qr.exhibitorName}
            websiteUrl={qr.websiteUrl}
            missingHref={href}
          />
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
  reviewQueue,
  waitingQueue,
  missingWebsite,
  qrScans,
  reviewCount,
  waitingOnWineryCount,
  executedBoothCount,
  qrReadyCount,
  qrGeneratedCount,
  eventYear,
}: Props) {
  const hasQueue =
    reviewCount > 0 || stuck.length > 0 || waitingOnWineryCount > 0 || missingWebsite.length > 0;

  return (
    <Card className="border-fest-600/15">
      <CardHeader className="pb-4">
        <CardTitle className="font-serif text-xl font-semibold">Action queue</CardTitle>
        <p className="text-sm text-muted-foreground">
          Review, waiting on winery, booth QRs for executed licenses, and signed but not yet released
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
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
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-sky-950">
                {reviewCount} awaiting approval
              </p>
              <Button asChild size="sm" variant="outline" className="h-8">
                <Link href="/wine-spectator/contracts?status=pending_events_review">Review all</Link>
              </Button>
            </div>
            <ul className="space-y-2">
              {reviewQueue.slice(0, 6).map((row) => (
                <QueueRow
                  key={row.id}
                  title={row.exhibitorCompanyName}
                  subtitle={[row.legalName, row.signerName].filter(Boolean).join(' · ') || 'Needs review'}
                  href={`/wine-spectator/contracts/${row.id}`}
                  amount={row.grandTotalCents}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {waitingOnWineryCount > 0 ? (
          <section className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Send className="h-4 w-4 shrink-0" aria-hidden />
              {waitingOnWineryCount} waiting on winery
            </p>
            <ul className="space-y-2">
              {waitingQueue.slice(0, 6).map((row) => (
                <QueueRow
                  key={row.id}
                  title={row.exhibitorCompanyName}
                  subtitle={[row.legalName, row.signerName].filter(Boolean).join(' · ') || 'Sent for signature'}
                  href={`/wine-spectator/contracts/${row.id}`}
                  amount={row.grandTotalCents}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="space-y-3 rounded-xl border border-fest-600/15 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4 shrink-0" aria-hidden />
              Booth QR codes
            </p>
            <NyweBoothQrBookButton
              readyCount={qrReadyCount}
              eventYear={eventYear}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Built from executed vendor licenses only (not drafts, not sponsorships).
          </p>
          <p className="text-sm">
            <span className="font-medium tabular-nums">{executedBoothCount}</span>
            {' '}executed
            {' · '}
            <span className="font-medium tabular-nums">{qrReadyCount}</span>
            {' '}ready to print
            {' · '}
            <span className="font-medium tabular-nums">{qrGeneratedCount}</span>
            {' '}short link{qrGeneratedCount === 1 ? '' : 's'} created
            {missingWebsite.length > 0 ? (
              <>
                {' · '}
                <span className="font-medium tabular-nums text-amber-900">{missingWebsite.length}</span>
                {' '}need a website
              </>
            ) : null}
          </p>

          {missingWebsite.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-950">Add a winery URL before printing these signs</p>
              <ul className="space-y-2">
                {missingWebsite.slice(0, 12).map((row) => (
                  <QueueRow
                    key={row.id}
                    title={row.exhibitorCompanyName}
                    subtitle="Missing website URL"
                    href={`/wine-spectator/contracts/${row.id}`}
                    qr={{
                      contractId: row.id,
                      exhibitorName: row.exhibitorCompanyName,
                      websiteUrl: row.websiteUrl ?? null,
                    }}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {qrScans.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Scans
              </p>
              <ul className="space-y-2">
                {qrScans.slice(0, 8).map((row) => (
                  <QueueRow
                    key={row.id}
                    title={row.exhibitorCompanyName}
                    subtitle={
                      <>
                        {row.clicks} scan{row.clicks === 1 ? '' : 's'}
                        {row.lastClickAt ? (
                          <>
                            {' · last '}
                            <RelativeTime iso={row.lastClickAt} />
                          </>
                        ) : null}
                        {row.shortUrl ? ` · ${row.shortUrl.replace(/^https?:\/\//, '')}` : null}
                      </>
                    }
                    href={`/wine-spectator/contracts/${row.id}`}
                    qr={{
                      contractId: row.id,
                      exhibitorName: row.exhibitorCompanyName,
                      websiteUrl: row.websiteUrl ?? null,
                    }}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {stuck.length > 0 ? (
          <section>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Signed, not yet released ({stuck.length})
            </p>
            <ul className="space-y-2">
              {stuck.slice(0, 8).map((row) => (
                <QueueRow
                  key={row.id}
                  title={row.exhibitorCompanyName}
                  subtitle={[row.legalName, row.signerName].filter(Boolean).join(' · ') || 'Finishing automatically'}
                  href={`/wine-spectator/contracts/${row.id}`}
                  amount={row.grandTotalCents}
                />
              ))}
            </ul>
          </section>
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
                  qr={
                    row.websiteUrl
                      ? {
                          contractId: row.id,
                          exhibitorName: row.exhibitorCompanyName,
                          websiteUrl: row.websiteUrl,
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
