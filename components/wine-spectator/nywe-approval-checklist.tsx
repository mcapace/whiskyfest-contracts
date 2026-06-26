'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink, FileText, MapPin, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/contracts/status-badge';
import { cn, formatCurrency } from '@/lib/utils';
import type { ContractStatus } from '@/types/db';

export type NyweApprovalChecklistRow = {
  rowKey: string;
  wineryName: string;
  signerName: string;
  signerEmail: string;
  contractId: string;
  contractStatus: ContractStatus;
  addressPreview: string;
  addressMissing: boolean;
  grandTotalCents: number | null;
};

type Props = {
  pendingReview: NyweApprovalChecklistRow[];
  inProgress: NyweApprovalChecklistRow[];
  approvedCount: number;
};

export function NyweApprovalChecklist({ pendingReview, inProgress, approvedCount }: Props) {
  const waiting = pendingReview.length + inProgress.length;
  const total = approvedCount + waiting;
  const pct = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

  if (waiting === 0 && approvedCount === 0) return null;

  return (
    <section className="rounded-xl border border-sky-300/80 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-900/80">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Step 2 — Approve each contract before sending
          </p>
          <h3 className="mt-1 font-serif text-lg font-semibold text-foreground">
            {pendingReview.length > 0
              ? `${pendingReview.length} waiting for your PDF review`
              : inProgress.length > 0
                ? `${inProgress.length} still need a PDF submitted`
                : `${approvedCount} approved — ready for bulk send`}
          </h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Open each contract, scroll the PDF, confirm the address and $14,000 fee, then click{' '}
            <strong>Approve Contract</strong>. Bulk send only includes approved contracts.
          </p>
        </div>
        {total > 0 ? (
          <div className="min-w-[8rem] text-right">
            <p className="text-2xl font-semibold tabular-nums text-sky-950">{pct}%</p>
            <p className="text-xs text-muted-foreground">
              {approvedCount} of {total} approved
            </p>
          </div>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-sky-100">
          <div
            className="h-full bg-sky-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      ) : null}

      {pendingReview.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {pendingReview.map((row) => (
            <ChecklistCard key={row.rowKey} row={row} actionLabel="Open & review PDF" actionTone="primary" />
          ))}
        </ul>
      ) : null}

      {inProgress.length > 0 ? (
        <div className={cn(pendingReview.length > 0 && 'mt-5 border-t border-sky-200/80 pt-5')}>
          <p className="mb-3 text-sm font-medium text-muted-foreground">
            Not submitted for review yet — open the contract and use <strong>Generate Draft PDF</strong> first.
          </p>
          <ul className="space-y-3">
            {inProgress.map((row) => (
              <ChecklistCard key={row.rowKey} row={row} actionLabel="Open contract" actionTone="outline" />
            ))}
          </ul>
        </div>
      ) : null}

      {approvedCount > 0 && pendingReview.length === 0 && inProgress.length === 0 ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-950">
          All contracts in the pipeline are approved. Go to <strong>Step 3 — Send to wineries</strong> below.
        </p>
      ) : null}
    </section>
  );
}

function ChecklistCard({
  row,
  actionLabel,
  actionTone,
}: {
  row: NyweApprovalChecklistRow;
  actionLabel: string;
  actionTone: 'primary' | 'outline';
}) {
  const href = `/wine-spectator/contracts/${row.contractId}`;

  return (
    <li className="rounded-lg border border-border/70 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{row.wineryName}</p>
            <StatusBadge status={row.contractStatus} />
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {row.signerName || 'Signer'} · {row.signerEmail || '—'}
          </p>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className={cn(row.addressMissing && 'text-amber-800 font-medium')}>{row.addressPreview}</span>
          </p>
          {row.addressMissing ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Missing street address in Google Sheets — fix before approving.
            </p>
          ) : null}
          {row.grandTotalCents != null ? (
            <p className="text-sm font-medium tabular-nums text-foreground">
              {formatCurrency(row.grandTotalCents)} contract fee
            </p>
          ) : null}
        </div>
        <Button
          asChild
          size="sm"
          variant={actionTone === 'primary' ? 'default' : 'outline'}
          className="shrink-0"
        >
          <Link href={href} target="_blank" rel="noopener noreferrer">
            <FileText className="h-4 w-4" />
            {actionLabel}
            <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
          </Link>
        </Button>
      </div>
    </li>
  );
}
