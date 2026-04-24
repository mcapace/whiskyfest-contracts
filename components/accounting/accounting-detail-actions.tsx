'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { BottomActionBar } from '@/components/contract/bottom-action-bar';
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

  const fabVisible = useMemo(
    () => invoiceStatus === 'pending' || invoiceStatus === 'invoice_sent',
    [invoiceStatus],
  );
  const actionCount = invoiceStatus === 'pending' || invoiceStatus === 'invoice_sent' ? 1 : 0;
  const fabBtn =
    'h-10 shrink-0 gap-2 rounded-full px-4 text-sm font-medium motion-safe:transition-transform motion-safe:duration-150 hover:brightness-[1.04] active:scale-[0.98]';

  return (
    <div className="space-y-6">
      {err && <p className="text-sm text-destructive">{err}</p>}

      <div data-tour="accounting-actions-bar">
        <BottomActionBar visible={fabVisible} actionsCount={actionCount}>
        {invoiceStatus === 'pending' && (
          <Button
            type="button"
            className={fabBtn}
            onClick={markInvoiceSent}
            disabled={busy}
            title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
          >
            {pending ? 'Saving…' : 'Mark Invoice Sent'}
          </Button>
        )}
        {invoiceStatus === 'invoice_sent' && (
          <Button
            type="button"
            className={fabBtn}
            onClick={markPaid}
            disabled={busy}
            title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
          >
            {pending ? 'Saving…' : 'Mark Paid'}
          </Button>
        )}
        </BottomActionBar>
      </div>

      {invoiceStatus === 'paid' && (
        <div className="divide-y divide-border/50 border-b border-border/50 pb-6 text-sm text-muted-foreground">
          <p>
            Invoice sent{invoiceSentLabel ? `: ${invoiceSentLabel}` : ''}
            {invoiceSentBy ? ` · ${invoiceSentBy}` : ''}
          </p>
          <p className="pt-3">
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
