'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Banknote, Send } from 'lucide-react';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { ActionWithHelp } from '@/components/contract/action-with-help';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CONTRACT_ACTION_HELP } from '@/lib/contract-action-help-text';
import { Textarea } from '@/components/ui/input';
import type { InvoiceStatus } from '@/types/db';

export function AccountingDetailActions({
  contractId,
  invoiceStatus,
  invoiceSentLabel,
  invoiceSentBy,
  paidLabel,
  paidBy,
  initialNotes,
  notesRecordUpdatedLabel,
}: {
  contractId: string;
  invoiceStatus: InvoiceStatus;
  invoiceSentLabel: string | null;
  invoiceSentBy: string | null;
  paidLabel: string | null;
  paidBy: string | null;
  initialNotes: string | null;
  /** Contract row `updated_at` (reflects last save including notes). */
  notesRecordUpdatedLabel: string | null;
}) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [err, setErr] = useState<string | null>(null);

  async function patch(body: object) {
    setErr(null);
    const res = await fetch(`/api/accounting/contracts/${contractId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof data.error === 'string' ? data.error : 'Request failed');
      return;
    }
    router.refresh();
  }

  function markInvoiceSent() {
    startTransition(() => void patch({ mark_invoice_sent: true }));
  }

  function markPaid() {
    startTransition(() => void patch({ mark_paid: true }));
  }

  function saveNotes() {
    startTransition(() => void patch({ accounting_notes: notes }));
  }

  const showPrimaryAction = invoiceStatus === 'pending' || invoiceStatus === 'invoice_sent';

  return (
    <div className="space-y-6">
      {err && <p className="text-sm text-destructive">{err}</p>}

      {showPrimaryAction ? (
        <section
          className="rounded-lg border border-border/60 bg-card/40 p-4 md:p-6"
          data-tour="accounting-actions-bar"
        >
          <p className="wf-label-caps text-[0.6rem] text-muted-foreground">AR actions</p>
          <TooltipProvider delayDuration={300} skipDelayDuration={200}>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {invoiceStatus === 'pending' && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.markInvoiceSent}>
                  <Button
                    type="button"
                    data-tour="accounting-mark-invoice-sent"
                    className="h-10 gap-2 px-5"
                    onClick={markInvoiceSent}
                    disabled={busy}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <Send className="h-4 w-4 shrink-0" aria-hidden />
                    {pending ? 'Saving…' : 'Mark Invoice Sent'}
                  </Button>
                </ActionWithHelp>
              )}
              {invoiceStatus === 'invoice_sent' && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.markPaid}>
                  <Button
                    type="button"
                    data-tour="accounting-mark-paid"
                    className="h-10 gap-2 px-5"
                    onClick={markPaid}
                    disabled={busy}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <Banknote className="h-4 w-4 shrink-0" aria-hidden />
                    {pending ? 'Saving…' : 'Mark Paid'}
                  </Button>
                </ActionWithHelp>
              )}
            </div>
          </TooltipProvider>
        </section>
      ) : null}

      {invoiceStatus === 'paid' && (
        <div className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground md:p-6">
          <p className="wf-label-caps text-[0.6rem] text-muted-foreground">Invoice history</p>
          <p className="mt-3">
            Invoice sent{invoiceSentLabel ? `: ${invoiceSentLabel}` : ''}
            {invoiceSentBy ? ` · ${invoiceSentBy}` : ''}
          </p>
          <p className="mt-2">
            Paid{paidLabel ? `: ${paidLabel}` : ''}
            {paidBy ? ` · ${paidBy}` : ''}
          </p>
        </div>
      )}
      {invoiceStatus === 'invoice_sent' && (
        <p className="text-sm text-muted-foreground">
          Invoice sent{invoiceSentLabel ? ` on ${invoiceSentLabel}` : ''}
          {invoiceSentBy ? ` by ${invoiceSentBy}` : ''}
        </p>
      )}

      <div className="rounded-lg border border-border/60 bg-card/40 p-4 md:p-6">
        <h3 className="font-serif text-lg font-semibold">Accounting notes</h3>
        <Textarea className="mt-3 min-h-[120px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button
          type="button"
          className="mt-3"
          variant="secondary"
          onClick={saveNotes}
          disabled={busy}
          title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
        >
          {pending ? 'Saving…' : 'Save notes'}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Saves to accounting_notes on this contract.</p>
        {notesRecordUpdatedLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">Last updated {notesRecordUpdatedLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
