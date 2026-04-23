'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="space-y-6">
      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
        <h3 className="font-serif text-lg font-semibold">Actions</h3>
        {invoiceStatus === 'pending' && (
          <div className="mt-3">
            <Button
              type="button"
              onClick={markInvoiceSent}
              disabled={busy}
              title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
            >
              {pending ? 'Saving…' : 'Mark Invoice Sent'}
            </Button>
          </div>
        )}
        {invoiceStatus === 'invoice_sent' && (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              Invoice sent{invoiceSentLabel ? ` on ${invoiceSentLabel}` : ''}
              {invoiceSentBy ? ` by ${invoiceSentBy}` : ''}
            </p>
            <Button
              type="button"
              onClick={markPaid}
              disabled={busy}
              title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
            >
              {pending ? 'Saving…' : 'Mark Paid'}
            </Button>
          </div>
        )}
        {invoiceStatus === 'paid' && (
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p>
              Invoice sent{invoiceSentLabel ? `: ${invoiceSentLabel}` : ''}
              {invoiceSentBy ? ` · ${invoiceSentBy}` : ''}
            </p>
            <p>
              Paid{paidLabel ? `: ${paidLabel}` : ''}
              {paidBy ? ` · ${paidBy}` : ''}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-card/40 p-4">
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
