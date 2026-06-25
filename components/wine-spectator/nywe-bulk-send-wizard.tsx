'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Mail, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatCurrency } from '@/lib/utils';

export type NyweBulkSendRow = {
  rowKey: string;
  wineryName: string;
  signerName: string;
  signerEmail: string;
  contractId: string;
  grandTotalCents?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterIsApproved: boolean;
  sendable: NyweBulkSendRow[];
  skippedNotApproved: { wineryName: string; status: string | null }[];
  onShowApprovedFilter: () => void;
  onSelectAllApproved: () => void;
  onComplete?: (summary: { sent: number; failed: number }) => void;
};

type WizardStep = 'filter' | 'select' | 'review' | 'sending' | 'done';

export function NyweBulkSendWizard({
  open,
  onOpenChange,
  filterIsApproved,
  sendable,
  skippedNotApproved,
  onShowApprovedFilter,
  onSelectAllApproved,
  onComplete,
}: Props) {
  const [step, setStep] = useState<WizardStep>('filter');
  const [confirmed, setConfirmed] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ sent: number; failed: number; failures: { name: string; error?: string }[] } | null>(
    null,
  );

  const contractIds = useMemo(() => sendable.map((r) => r.contractId), [sendable]);

  useEffect(() => {
    if (!open) {
      setStep('filter');
      setConfirmed(false);
      setProgress({ current: 0, total: 0 });
      setResult(null);
      return;
    }
    if (!filterIsApproved) {
      setStep('filter');
    } else if (sendable.length === 0) {
      setStep('select');
    } else {
      setStep('review');
      setConfirmed(false);
    }
  }, [open, filterIsApproved, sendable.length]);

  async function runSend() {
    setStep('sending');
    setProgress({ current: 0, total: contractIds.length });
    let sent = 0;
    let failed = 0;
    const failures: { name: string; error?: string }[] = [];

    for (let i = 0; i < sendable.length; i++) {
      const row = sendable[i]!;
      setProgress({ current: i + 1, total: sendable.length });
      const res = await fetch(`/api/contracts/${row.contractId}/send`, { method: 'POST' });
      if (res.ok) {
        sent += 1;
      } else {
        failed += 1;
        const json = await res.json().catch(() => ({}));
        failures.push({ name: row.wineryName, error: typeof json.error === 'string' ? json.error : undefined });
      }
    }

    const summary = { sent, failed, failures };
    setResult(summary);
    setStep('done');
    onComplete?.({ sent: summary.sent, failed: summary.failed });
    return summary;
  }

  function closeWizard() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Guided bulk send</DialogTitle>
          <DialogDescription>
            We&apos;ll walk you through each step so DocuSign emails go to the right winery contacts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <WizardStepper active={step} />

          {step === 'filter' ? (
            <StepBox tone="amber">
              <p className="font-medium text-foreground">Step 1 — Show approved licenses only</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Bulk send only works for licenses you have already <strong>Approved</strong>. Let&apos;s filter the list
                so you are not looking at drafts or licenses already sent.
              </p>
              <Button type="button" className="mt-4" onClick={onShowApprovedFilter}>
                Show approved licenses
              </Button>
            </StepBox>
          ) : null}

          {step === 'select' ? (
            <StepBox tone="sky">
              <p className="font-medium text-foreground">Step 2 — Select wineries to email</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Check the box next to each approved winery, or use <strong>Select all approved</strong> to grab
                everyone on this screen at once.
              </p>
              {skippedNotApproved.length > 0 ? (
                <p className="mt-3 text-xs text-amber-800">
                  {skippedNotApproved.length} selected row{skippedNotApproved.length === 1 ? '' : 's'} cannot be sent
                  yet (not approved). Only approved licenses will be included.
                </p>
              ) : null}
              <Button type="button" className="mt-4" variant="secondary" onClick={onSelectAllApproved}>
                Select all approved on this page
              </Button>
              {sendable.length > 0 ? (
                <Button type="button" className="mt-2 w-full sm:w-auto" onClick={() => setStep('review')}>
                  Continue with {sendable.length} selected
                </Button>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No approved licenses selected yet.</p>
              )}
            </StepBox>
          ) : null}

          {step === 'review' ? (
            <StepBox tone="rose">
              <p className="font-medium text-foreground">Step 3 — Review who will get DocuSign</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Each winery below will receive a signing email at the address shown. Confirm this looks correct before
                sending.
              </p>
              <ul className="mt-4 max-h-52 space-y-2 overflow-y-auto rounded-md border border-border/60 bg-white/80 p-3 text-sm">
                {sendable.map((row) => (
                  <li key={row.rowKey} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
                    <p className="font-medium text-foreground">{row.wineryName}</p>
                    <p className="text-muted-foreground">
                      {row.signerName || 'Signer'} · {row.signerEmail || '—'}
                    </p>
                    {row.grandTotalCents != null ? (
                      <p className="text-xs text-muted-foreground">{formatCurrency(row.grandTotalCents)} license</p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {skippedNotApproved.length > 0 ? (
                <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    Skipping {skippedNotApproved.length} selected winery
                    {skippedNotApproved.length === 1 ? '' : 'ies'} that {skippedNotApproved.length === 1 ? 'is' : 'are'}{' '}
                    not approved yet.
                  </p>
                </div>
              ) : null}
              <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I reviewed the list above. DocuSign may email each signer immediately after I click send.
                </span>
              </label>
            </StepBox>
          ) : null}

          {step === 'sending' ? (
            <StepBox tone="neutral">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending {progress.current} of {progress.total}…
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Please keep this window open until finished.</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-rose-700 transition-all duration-300"
                  style={{
                    width: progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%',
                  }}
                />
              </div>
            </StepBox>
          ) : null}

          {step === 'done' && result ? (
            <StepBox tone={result.failed > 0 ? 'amber' : 'emerald'}>
              <p className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                {result.sent} sent · {result.failed} failed
              </p>
              {result.failures.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-amber-950">
                  {result.failures.map((f) => (
                    <li key={f.name}>
                      {f.name}
                      {f.error ? ` — ${f.error}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                <p className="flex items-center gap-2 font-medium">
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  What happens next
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-sky-900/90">
                  <li>Each winery receives a DocuSign email to sign their license.</li>
                  <li>When they sign, you get a DocuSign email to countersign.</li>
                  <li>After you countersign, accounting is notified automatically — nothing else to do here.</li>
                </ol>
                <Link href="/wine-spectator" className="mt-3 inline-block text-sm font-medium text-sky-800 underline">
                  Back to Home to track progress
                </Link>
              </div>
            </StepBox>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === 'review' ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button type="button" disabled={!confirmed || sendable.length === 0} onClick={() => void runSend()}>
                Send {sendable.length} DocuSign email{sendable.length === 1 ? '' : 's'}
              </Button>
            </>
          ) : step === 'done' ? (
            <Button type="button" onClick={closeWizard}>
              Done
            </Button>
          ) : step !== 'sending' ? (
            <Button type="button" variant="outline" onClick={closeWizard}>
              Close
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WizardStepper({ active }: { active: WizardStep }) {
  const labels = ['Filter', 'Select', 'Review', 'Send', 'Done'];
  const index = ['filter', 'select', 'review', 'sending', 'done'].indexOf(active);

  return (
    <div className="flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {labels.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-[10px]',
              i <= index ? 'bg-rose-700 text-white' : 'bg-muted text-muted-foreground',
            )}
          >
            {i + 1}
          </div>
          <span className={cn(i === index && 'text-rose-900')}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function StepBox({
  tone,
  children,
}: {
  tone: 'amber' | 'sky' | 'rose' | 'emerald' | 'neutral';
  children: ReactNode;
}) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50/90',
    sky: 'border-sky-200 bg-sky-50/90',
    rose: 'border-rose-200 bg-rose-50/40',
    emerald: 'border-emerald-200 bg-emerald-50/90',
    neutral: 'border-border bg-muted/20',
  };
  return <div className={cn('rounded-lg border p-4', styles[tone])}>{children}</div>;
}
