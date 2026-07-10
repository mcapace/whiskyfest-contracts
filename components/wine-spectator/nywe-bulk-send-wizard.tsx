'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

export type NyweBulkSendRow = {
  rowKey: string;
  wineryName: string;
  signerName: string;
  signerEmail: string;
  contractId: string;
  signerCcName?: string | null;
  signerCcEmail?: string | null;
  grandTotalCents?: number | null;
  addressPreview?: string;
  addressMissing?: boolean;
};

type CcDraft = {
  name: string;
  email: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sendable: NyweBulkSendRow[];
  onComplete?: (summary: { sent: number; failed: number }) => void;
};

type DialogPhase = 'confirm' | 'sending' | 'done';

function ccDraftFromRow(row: NyweBulkSendRow): CcDraft {
  return {
    name: row.signerCcName?.trim() ?? '',
    email: row.signerCcEmail?.trim() ?? '',
  };
}

export function NyweBulkSendWizard({ open, onOpenChange, sendable, onComplete }: Props) {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [ccByRowKey, setCcByRowKey] = useState<Record<string, CcDraft>>({});
  const [result, setResult] = useState<{ sent: number; failed: number; failures: { name: string; error?: string }[] } | null>(
    null,
  );

  const totalFeesCents = useMemo(
    () => sendable.reduce((sum, r) => sum + (r.grandTotalCents ?? 0), 0),
    [sendable],
  );
  const missingAddressCount = useMemo(() => sendable.filter((r) => r.addressMissing).length, [sendable]);
  const ccCount = useMemo(
    () => sendable.filter((row) => ccByRowKey[row.rowKey]?.email.trim()).length,
    [sendable, ccByRowKey],
  );
  const canSend = sendable.length > 0 && missingAddressCount === 0;

  useEffect(() => {
    if (!open) {
      setPhase('confirm');
      setProgress({ current: 0, total: 0 });
      setResult(null);
      return;
    }
    setCcByRowKey(Object.fromEntries(sendable.map((row) => [row.rowKey, ccDraftFromRow(row)])));
  }, [open, sendable]);

  function setCcField(rowKey: string, field: keyof CcDraft, value: string) {
    setCcByRowKey((prev) => ({
      ...prev,
      [rowKey]: {
        name: prev[rowKey]?.name ?? '',
        email: prev[rowKey]?.email ?? '',
        [field]: value,
      },
    }));
  }

  async function runSend() {
    setPhase('sending');
    setProgress({ current: 0, total: sendable.length });
    let sent = 0;
    let failed = 0;
    const failures: { name: string; error?: string }[] = [];

    for (let i = 0; i < sendable.length; i++) {
      const row = sendable[i]!;
      const cc = ccByRowKey[row.rowKey] ?? { name: '', email: '' };
      setProgress({ current: i + 1, total: sendable.length });
      const res = await fetch(`/api/contracts/${row.contractId}/nywe-client-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_cc_name: cc.name.trim() || null,
          signer_cc_email: cc.email.trim() || null,
        }),
      });
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
    setPhase('done');
    onComplete?.({ sent: summary.sent, failed: summary.failed });
  }

  function closeWizard() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Bulk send to clients</DialogTitle>
          <DialogDescription>
            Generates each PDF, marks it approved from roster data, and emails DocuSign — no need to open contracts
            individually. Optionally add a DocuSign CC per winery (assistant or colleague — they receive notifications
            but do not sign).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {phase === 'confirm' ? (
            <div className="rounded-lg border border-fest-200 bg-fest-50/40 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    Send {sendable.length} DocuSign email{sendable.length === 1 ? '' : 's'}?
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Each draft contract is treated as <strong>pre-approved</strong> from the roster. PDFs are generated
                    fresh, then DocuSign emails go to each winery signer immediately.
                  </p>
                  {ccCount > 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {ccCount} winery{ccCount === 1 ? '' : 'ies'} will include a DocuSign CC.
                    </p>
                  ) : null}
                </div>
                <div className="rounded-lg border border-fest-200 bg-white/90 px-4 py-2 text-center">
                  <p className="text-2xl font-semibold tabular-nums text-fest-950">{sendable.length}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Wineries</p>
                  {totalFeesCents > 0 ? (
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">{formatCurrency(totalFeesCents)} total</p>
                  ) : null}
                </div>
              </div>

              {sendable.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No draft contracts ready to send. Create contracts from the roster first, then try again.
                </p>
              ) : null}

              {missingAddressCount > 0 ? (
                <div className="mt-4 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    {missingAddressCount} approved contract{missingAddressCount === 1 ? '' : 's'} missing a street address.
                    Fix in Google Sheets, refresh the roster, and approve again before sending.
                  </p>
                </div>
              ) : null}

              {sendable.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Wineries &amp; optional DocuSign CC</p>
                  <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border/70 bg-background/80 p-3">
                    {sendable.map((row) => {
                      const cc = ccByRowKey[row.rowKey] ?? { name: '', email: '' };
                      return (
                        <div key={row.rowKey} className="space-y-2 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                          <div>
                            <p className="font-medium text-foreground">{row.wineryName}</p>
                            <p className="text-xs text-muted-foreground">
                              Signer: {row.signerName.trim() || row.signerEmail}
                              {row.signerName.trim() ? ` · ${row.signerEmail}` : ''}
                            </p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label htmlFor={`cc-name-${row.rowKey}`} className="text-xs text-muted-foreground">
                                CC name (optional)
                              </Label>
                              <Input
                                id={`cc-name-${row.rowKey}`}
                                value={cc.name}
                                onChange={(e) => setCcField(row.rowKey, 'name', e.target.value)}
                                placeholder="Assistant name"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`cc-email-${row.rowKey}`} className="text-xs text-muted-foreground">
                                CC email (optional)
                              </Label>
                              <Input
                                id={`cc-email-${row.rowKey}`}
                                type="email"
                                value={cc.email}
                                onChange={(e) => setCcField(row.rowKey, 'email', e.target.value)}
                                placeholder="assistant@company.com"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === 'sending' ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Sending {progress.current} of {progress.total}…
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Keep this window open until finished.</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-fest-700 transition-all duration-300"
                  style={{
                    width: progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%',
                  }}
                />
              </div>
            </div>
          ) : null}

          {phase === 'done' && result ? (
            <div
              className={`rounded-lg border p-4 ${result.failed > 0 ? 'border-amber-200 bg-amber-50/90' : 'border-emerald-200 bg-emerald-50/90'}`}
            >
              <p className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                {result.sent} sent · {result.failed} failed
              </p>
              {result.failures.length > 0 ? (
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-amber-950">
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
                  <li>Each winery receives a DocuSign email to sign their contract.</li>
                  <li>Anyone CC&apos;d on the envelope also receives DocuSign notifications.</li>
                  <li>When they sign, you get a DocuSign email to countersign.</li>
                  <li>After you countersign, accounting is notified automatically.</li>
                </ol>
                <Link href="/wine-spectator" className="mt-3 inline-block text-sm font-medium text-sky-800 underline">
                  Back to Home to track progress
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {phase === 'confirm' ? (
            <>
              <Button type="button" variant="outline" onClick={closeWizard}>
                Cancel
              </Button>
              <Button type="button" disabled={!canSend} onClick={() => void runSend()}>
                <Send className="h-4 w-4" />
                Send {sendable.length} DocuSign email{sendable.length === 1 ? '' : 's'}
              </Button>
            </>
          ) : phase === 'done' ? (
            <Button type="button" onClick={closeWizard}>
              Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
