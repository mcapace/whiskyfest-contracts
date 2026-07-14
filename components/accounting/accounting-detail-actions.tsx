'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { Banknote, Save, Send, Undo2, Ban, RotateCcw } from 'lucide-react';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { ActionWithHelp } from '@/components/contract/action-with-help';
import {
  contractActionBtnDanger,
  contractActionBtnPrimary,
  contractActionBtnSecondary,
  ContractActionButtonLabel,
} from '@/components/contract/contract-action-bar';
import {
  ACCOUNTING_ACTIONS_SIDEBAR_STORAGE_KEY,
  ContractActionsSidebar,
  ContractActionsSidebarGroup,
  useContractActionsSidebar,
} from '@/components/contract/contract-actions-sidebar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CONTRACT_ACTION_HELP } from '@/lib/contract-action-help-text';
import { Label, Textarea } from '@/components/ui/input';
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
  const { data: session } = useSession();
  const impersonationReadOnly = useImpersonationReadOnly();
  const isAccountingUser = Boolean(session?.user?.is_accounting);
  const isAdmin = session?.user?.role === 'admin';
  /** Impersonation is read-only except when viewing as an accounting user (AR can work while impersonated). */
  const readOnly = impersonationReadOnly && !isAccountingUser;
  const canVoidInvoice = isAdmin || isAccountingUser;
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [openVoid, setOpenVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  const sidebarVisible =
    invoiceStatus === 'pending' || invoiceStatus === 'invoice_sent' || invoiceStatus === 'invoice_voided';
  const isDoNotInvoice = invoiceStatus === 'not_invoiced';
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useContractActionsSidebar(
    false,
    ACCOUNTING_ACTIONS_SIDEBAR_STORAGE_KEY,
  );

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
      return false;
    }
    router.refresh();
    return true;
  }

  function markInvoiceSent() {
    startTransition(() => void patch({ mark_invoice_sent: true }));
  }

  function markPaid() {
    startTransition(() => void patch({ mark_paid: true }));
  }

  function recallInvoiceSent() {
    if (
      !window.confirm(
        'Recall Invoice Sent? This returns the contract to Pending Invoice so you can correct and mark sent again. The billed export sheet will update.',
      )
    ) {
      return;
    }
    startTransition(() => void patch({ recall_invoice_sent: true }));
  }

  function submitVoidInvoice() {
    if (voidReason.trim().length < 5) return;
    startTransition(async () => {
      const ok = await patch({ void_invoice_sent: true, void_reason: voidReason.trim() });
      if (ok) {
        setOpenVoid(false);
        setVoidReason('');
      }
    });
  }

  function restoreVoidedInvoice() {
    if (
      !window.confirm(
        'Restore this voided invoice to Pending? Accounting can then mark invoice sent again.',
      )
    ) {
      return;
    }
    startTransition(() => void patch({ restore_voided_invoice: true }));
  }

  function saveNotes() {
    startTransition(() => void patch({ accounting_notes: notes }));
  }

  const btnPrimary = contractActionBtnPrimary;
  const btnSecondary = contractActionBtnSecondary;
  const btnDanger = contractActionBtnDanger;

  return (
    <>
      <TooltipProvider delayDuration={300} skipDelayDuration={200}>
        <ContractActionsSidebar
          visible={sidebarVisible}
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          title="AR Actions"
        >
          <div data-tour="accounting-actions-bar" className="space-y-3">
            {readOnly ? (
              <p className="text-xs leading-snug text-amber-800 dark:text-amber-200">
                View-as mode is read-only for this user. Exit impersonation or view as an accounting user to update
                invoice status.
              </p>
            ) : null}
            {err ? <p className="text-xs text-destructive">{err}</p> : null}

            <ContractActionsSidebarGroup label="Invoice">
              {invoiceStatus === 'pending' && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.markInvoiceSent}>
                  <Button
                    type="button"
                    data-tour="accounting-mark-invoice-sent"
                    className={btnPrimary}
                    onClick={markInvoiceSent}
                    disabled={busy}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel
                      icon={Send}
                      label={pending ? 'Saving…' : 'Mark Invoice Sent'}
                      spinning={pending}
                    />
                  </Button>
                </ActionWithHelp>
              )}
              {invoiceStatus === 'invoice_sent' && (
                <>
                  <ActionWithHelp helpText={CONTRACT_ACTION_HELP.markPaid}>
                    <Button
                      type="button"
                      data-tour="accounting-mark-paid"
                      className={btnPrimary}
                      onClick={markPaid}
                      disabled={busy}
                      title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                    >
                      <ContractActionButtonLabel
                        icon={Banknote}
                        label={pending ? 'Saving…' : 'Mark Paid'}
                        spinning={pending}
                      />
                    </Button>
                  </ActionWithHelp>
                  <ActionWithHelp helpText={CONTRACT_ACTION_HELP.recallInvoiceSent}>
                    <Button
                      type="button"
                      data-tour="accounting-recall-invoice-sent"
                      className={btnSecondary}
                      onClick={recallInvoiceSent}
                      disabled={busy}
                      title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                    >
                      <ContractActionButtonLabel
                        icon={Undo2}
                        label={pending ? 'Saving…' : 'Recall Invoice Sent'}
                        spinning={pending}
                      />
                    </Button>
                  </ActionWithHelp>
                  {canVoidInvoice && (
                    <ActionWithHelp helpText={CONTRACT_ACTION_HELP.voidInvoiceSent}>
                      <Button
                        type="button"
                        data-tour="accounting-void-invoice-sent"
                        className={btnDanger}
                        onClick={() => setOpenVoid(true)}
                        disabled={busy}
                        title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                      >
                        <ContractActionButtonLabel icon={Ban} label="Void Invoice Sent" />
                      </Button>
                    </ActionWithHelp>
                  )}
                </>
              )}
              {invoiceStatus === 'invoice_voided' && canVoidInvoice && (
                <>
                  <ActionWithHelp helpText={CONTRACT_ACTION_HELP.markInvoiceSent}>
                    <Button
                      type="button"
                      data-tour="accounting-mark-invoice-sent"
                      className={btnPrimary}
                      onClick={markInvoiceSent}
                      disabled={busy}
                      title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                    >
                      <ContractActionButtonLabel
                        icon={Send}
                        label={pending ? 'Saving…' : 'Mark Invoice Sent'}
                        spinning={pending}
                      />
                    </Button>
                  </ActionWithHelp>
                  <ActionWithHelp helpText={CONTRACT_ACTION_HELP.restoreVoidedInvoice}>
                    <Button
                      type="button"
                      data-tour="accounting-restore-voided-invoice"
                      className={btnSecondary}
                      onClick={restoreVoidedInvoice}
                      disabled={busy}
                      title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                    >
                      <ContractActionButtonLabel
                        icon={RotateCcw}
                        label={pending ? 'Saving…' : 'Restore to Pending'}
                        spinning={pending}
                      />
                    </Button>
                  </ActionWithHelp>
                </>
              )}
            </ContractActionsSidebarGroup>
          </div>
        </ContractActionsSidebar>
      </TooltipProvider>

      <Dialog open={openVoid} onOpenChange={setOpenVoid}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void invoice sent</DialogTitle>
            <DialogDescription>
              Permanently voids this sent invoice and removes it from the billed export. The contract stays executed —
              only the invoice status changes. Use Restore to Pending later if you need to invoice again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="void-invoice-reason">Reason (required)</Label>
            <Textarea
              id="void-invoice-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={4}
              placeholder="e.g., Invoice issued to wrong entity; credit memo issued"
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenVoid(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submitVoidInvoice()}
              disabled={busy || voidReason.trim().length < 5}
            >
              {pending ? 'Voiding…' : 'Void invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-6">
        {isDoNotInvoice ? (
          <div className="rounded-lg border border-violet-300/80 bg-violet-50/60 p-4 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100 md:p-6">
            <p className="font-medium">Do Not Invoice</p>
            <p className="mt-2 text-violet-900/90 dark:text-violet-200/90">
              This is a complimentary WhiskyFest booth contract. It appears in A/R for tracking but should not be
              invoiced.
            </p>
          </div>
        ) : null}
        {invoiceStatus === 'invoice_voided' ? (
          <div className="rounded-lg border border-rose-300/80 bg-rose-50/60 p-4 text-sm text-rose-950 md:p-6">
            <p className="font-medium">Invoice voided</p>
            <p className="mt-2 text-rose-900/90">
              This sent invoice was cancelled and removed from the billed export. Use <strong>Mark Invoice Sent</strong>{' '}
              to re-issue (then Mark Paid), or Restore to Pending if you are not ready to send yet.
            </p>
          </div>
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
            <Save className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {pending ? 'Saving…' : 'Save notes'}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Saves to accounting_notes on this contract.</p>
          {notesRecordUpdatedLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">Last updated {notesRecordUpdatedLabel}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
