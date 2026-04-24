'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Undo2,
} from 'lucide-react';
import { ActionWithHelp } from '@/components/contract/action-with-help';
import { BottomActionBar } from '@/components/contract/bottom-action-bar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CONTRACT_ACTION_HELP } from '@/lib/contract-action-help-text';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { formatCurrency, formatRelative } from '@/lib/utils';
import type { ContractStatus } from '@/types/db';

const DISCOUNT_ACTION_BLOCKED = 'Discount approval required first';

/** Wraps actions blocked server-side when `requiresDiscountApproval`; tooltip explains why (disabled buttons do not receive hover). */
function WhenDiscountBlocks({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-not-allowed items-center rounded-full">{children}</span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{DISCOUNT_ACTION_BLOCKED}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface Props {
  contractId: string;
  exhibitorName: string;
  signerEmail: string | null;
  signerName: string | null;
  status: ContractStatus;
  draftPdfHref: string | null;
  signedPdfHref: string | null;
  docusignEnvelopeId: string | null;
  sentAt: string | null;
  updatedAt: string | null;
  executedAt: string | null;
  cancelledReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  errorDetails: string | null;
  isAdmin: boolean;
  releasedBy: string | null;
  releasedAt: string | null;
  boothCount: number;
  boothRateCents: number;
  grandTotalCents: number;
  boothSubtotalCents: number;
  lineItemsSubtotalCents: number;
  salesRep: string | null;
  salesRepEmail: string | null;
  countersignerName: string | null;
  countersignerEmail: string | null;
  createdBy: string | null;
  discountApprovalPending: boolean;
  isEventsTeam: boolean;
}

export function ContractActions({
  contractId,
  exhibitorName,
  signerEmail,
  signerName,
  status,
  draftPdfHref,
  signedPdfHref,
  docusignEnvelopeId,
  sentAt,
  updatedAt,
  executedAt,
  cancelledReason,
  cancelledAt,
  cancelledBy,
  errorDetails,
  isAdmin,
  releasedBy,
  releasedAt,
  boothCount,
  boothRateCents,
  grandTotalCents,
  boothSubtotalCents,
  lineItemsSubtotalCents,
  salesRep,
  salesRepEmail,
  countersignerName,
  countersignerEmail,
  createdBy,
  discountApprovalPending,
  isEventsTeam,
}: Props) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [action, setAction] = useState<string | null>(null);
  const [openRecall, setOpenRecall] = useState(false);
  const [openResendWithChanges, setOpenResendWithChanges] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [openVoid, setOpenVoid] = useState(false);
  const [openApproveDiscount, setOpenApproveDiscount] = useState(false);
  const [openErrorDetails, setOpenErrorDetails] = useState(false);
  const [openSendBack, setOpenSendBack] = useState(false);
  const [sendBackReason, setSendBackReason] = useState('');
  const [recallReason, setRecallReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [nextSignerName, setNextSignerName] = useState(signerName ?? '');
  const [nextSignerEmail, setNextSignerEmail] = useState(signerEmail ?? '');

  async function runAction(path: string, actionName: string, body?: Record<string, unknown>) {
    setAction(actionName);
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        router.refresh();
        queueMicrotask(() => router.refresh());
      } else {
        const j = await res.json().catch(() => ({}));
        alert(`Action failed: ${j.error ?? res.status}`);
      }
      setAction(null);
    });
  }

  const canReminder = isAdmin && (status === 'sent' || status === 'partially_signed') && Boolean(docusignEnvelopeId);
  const canRecall = canReminder;
  const canResendWithChanges = canReminder && !discountApprovalPending;
  const canVoid =
    (isAdmin || isEventsTeam) &&
    (status === 'sent' || status === 'partially_signed') &&
    Boolean(docusignEnvelopeId);
  /** In-flight DocuSign: reminder / recall / resend-with-changes / void */
  const hasDocuSignSecondary = canReminder || canResendWithChanges || canRecall || canVoid;
  /** Cancel contract while envelope is out (API allows cancel except executed/cancelled). */
  const canCancelInflightDocuSign =
    (status === 'sent' || status === 'partially_signed') && (isAdmin || isEventsTeam);
  const canCancelSigned = status === 'signed' && (isAdmin || isEventsTeam);
  const canRelease = status === 'signed' && isAdmin;
  const signerWaitLabel = signerName?.trim() || signerEmail?.trim() || 'signer';

  const fabVisible = useMemo(() => {
    if (status === 'draft') return true;
    if (status === 'ready_for_review' || status === 'pending_events_review') {
      if (discountApprovalPending) return true;
      if (status === 'ready_for_review') return true;
      if (status === 'pending_events_review') {
        if (isEventsTeam) return true;
        if (isAdmin && draftPdfHref) return true;
      }
    }
    if (status === 'approved') return true;
    if (hasDocuSignSecondary) return true;
    if (canCancelInflightDocuSign) return true;
    if (canRelease || canCancelSigned) return true;
    if (status === 'executed' && signedPdfHref) return true;
    if (status === 'error' && isAdmin) return true;
    return false;
  }, [
    status,
    discountApprovalPending,
    isEventsTeam,
    isAdmin,
    draftPdfHref,
    hasDocuSignSecondary,
    canCancelInflightDocuSign,
    canRelease,
    canCancelSigned,
    signedPdfHref,
  ]);

  const fabBtn =
    'h-10 shrink-0 gap-2 rounded-full px-4 text-sm font-medium motion-safe:transition-transform motion-safe:duration-150 hover:brightness-[1.04] active:scale-[0.98]';

  let actionsCount = 0;
  if (status === 'draft') actionsCount += isAdmin ? 3 : 2;
  if ((status === 'ready_for_review' || status === 'pending_events_review') && discountApprovalPending && isAdmin) actionsCount += 3;
  if ((status === 'ready_for_review' || status === 'pending_events_review') && discountApprovalPending && !isAdmin) actionsCount += 2;
  if (status === 'ready_for_review' && !discountApprovalPending) actionsCount += isAdmin ? 2 : 1;
  if (status === 'pending_events_review' && !discountApprovalPending && isEventsTeam) actionsCount += draftPdfHref ? 3 : 2;
  if (status === 'pending_events_review' && !discountApprovalPending && !isEventsTeam && isAdmin && draftPdfHref) actionsCount += 1;
  if (status === 'approved') actionsCount += isAdmin ? 2 : 1;
  if (canRelease) actionsCount += 1;
  if (status === 'executed' && signedPdfHref) actionsCount += 1;
  if (status === 'error' && isAdmin) actionsCount += 2;
  if (hasDocuSignSecondary) {
    if (canReminder) actionsCount += 1;
    if (canResendWithChanges) actionsCount += 1;
    if (canRecall) actionsCount += 1;
    if (canVoid) actionsCount += 1;
  }
  if (canCancelInflightDocuSign) actionsCount += 1;
  if (canCancelSigned) actionsCount += 1;

  return (
    <>
      <div className="space-y-5">
        <TooltipProvider delayDuration={300} skipDelayDuration={200}>
          <BottomActionBar visible={fabVisible} actionsCount={actionsCount}>
          {status === 'draft' && (
            <>
              <WhenDiscountBlocks active={discountApprovalPending}>
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.generateDraftPdf}>
                  <Button
                    className={fabBtn}
                    onClick={() => runAction('generate', 'generate')}
                    disabled={busy || discountApprovalPending}
                  >
                    {pending && action === 'generate' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Generate Draft PDF
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              {readOnly ? (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.editContract}>
                  <Button
                    type="button"
                    variant="secondary"
                    className={fabBtn}
                    disabled
                    title={IMPERSONATION_BUTTON_TOOLTIP}
                  >
                    Edit Contract
                  </Button>
                </ActionWithHelp>
              ) : (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.editContract}>
                  <Button variant="secondary" className={fabBtn} asChild>
                    <Link href={`/contracts/${contractId}/edit`}>Edit Contract</Link>
                  </Button>
                </ActionWithHelp>
              )}
              {isAdmin && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                  <Button
                    variant="outline"
                    className={`${fabBtn} text-destructive hover:text-destructive`}
                    onClick={() => setOpenCancel(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    Cancel Contract
                  </Button>
                </ActionWithHelp>
              )}
            </>
          )}

          {(status === 'ready_for_review' || status === 'pending_events_review') &&
            discountApprovalPending &&
            isAdmin && (
            <>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.approveDiscount}>
                <Button
                  className={`${fabBtn} border-amber-600 bg-amber-600 text-white hover:bg-amber-700`}
                  onClick={() => setOpenApproveDiscount(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Approve Discount
                </Button>
              </ActionWithHelp>
              <WhenDiscountBlocks active={discountApprovalPending}>
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.regeneratePdf}>
                  <Button
                    variant="secondary"
                    className={fabBtn}
                    onClick={() => runAction('generate', 'regenerate')}
                    disabled={busy || discountApprovalPending}
                  >
                    {pending && action === 'regenerate' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-generate PDF
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                <Button
                  variant="outline"
                  className={`${fabBtn} text-destructive hover:text-destructive`}
                  onClick={() => setOpenCancel(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  Cancel Contract
                </Button>
              </ActionWithHelp>
            </>
          )}

          {(status === 'ready_for_review' || status === 'pending_events_review') &&
            discountApprovalPending &&
            !isAdmin && (
            <>
              <WhenDiscountBlocks active={discountApprovalPending}>
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.regeneratePdf}>
                  <Button
                    variant="secondary"
                    className={fabBtn}
                    onClick={() => runAction('generate', 'regenerate')}
                    disabled={busy || discountApprovalPending}
                  >
                    {pending && action === 'regenerate' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Re-generate PDF
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.approveForSendingDisabled}>
                <Button
                  variant="secondary"
                  className={fabBtn}
                  disabled
                  title={DISCOUNT_ACTION_BLOCKED}
                >
                  Approve for Sending
                </Button>
              </ActionWithHelp>
            </>
          )}

          {status === 'ready_for_review' && !discountApprovalPending && (
            <>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.regeneratePdf}>
                <Button
                  variant="secondary"
                  className={fabBtn}
                  onClick={() => runAction('generate', 'regenerate')}
                  disabled={busy}
                >
                  <RefreshCw className="h-4 w-4" />
                  Re-generate PDF (submit for events review)
                </Button>
              </ActionWithHelp>
              {isAdmin && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                  <Button
                    variant="outline"
                    className={`${fabBtn} text-destructive hover:text-destructive`}
                    onClick={() => setOpenCancel(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    Cancel Contract
                  </Button>
                </ActionWithHelp>
              )}
            </>
          )}

          {status === 'pending_events_review' && !discountApprovalPending && isEventsTeam && (
            <>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.approveContract}>
                <Button
                  className={fabBtn}
                  onClick={() => runAction('events-approve', 'events-approve', {})}
                  disabled={busy}
                >
                  {pending && action === 'events-approve' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Approve Contract
                </Button>
              </ActionWithHelp>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.sendBack}>
                <Button
                  variant="secondary"
                  className={fabBtn}
                  onClick={() => setOpenSendBack(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  Send Back for Changes
                </Button>
              </ActionWithHelp>
              {draftPdfHref && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewDraftPdf}>
                  <Button variant="outline" className={fabBtn} asChild>
                    <a href={draftPdfHref} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      View Draft PDF
                    </a>
                  </Button>
                </ActionWithHelp>
              )}
            </>
          )}

          {status === 'pending_events_review' && !discountApprovalPending && !isEventsTeam && isAdmin && draftPdfHref && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewDraftPdf}>
              <Button variant="outline" className={fabBtn} asChild>
                <a href={draftPdfHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View Draft PDF
                </a>
              </Button>
            </ActionWithHelp>
          )}

          {status === 'approved' && (
            <>
              <WhenDiscountBlocks active={discountApprovalPending}>
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.sendViaDocusign}>
                  <Button
                    className={fabBtn}
                    onClick={() => runAction('send', 'send')}
                    disabled={busy || discountApprovalPending}
                  >
                    {pending && action === 'send' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send via DocuSign
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              {isAdmin && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                  <Button
                    variant="outline"
                    className={`${fabBtn} text-destructive hover:text-destructive`}
                    onClick={() => setOpenCancel(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    Cancel Contract
                  </Button>
                </ActionWithHelp>
              )}
            </>
          )}

          {canRelease && (
            <WhenDiscountBlocks active={discountApprovalPending}>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.releaseToAccounting}>
                <Button
                  className={fabBtn}
                  onClick={() => runAction('release', 'release')}
                  disabled={busy || discountApprovalPending}
                >
                  {pending && action === 'release' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Release to Accounting
                </Button>
              </ActionWithHelp>
            </WhenDiscountBlocks>
          )}

          {canCancelSigned && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
              <Button
                variant="outline"
                className={`${fabBtn} text-destructive hover:text-destructive`}
                onClick={() => setOpenCancel(true)}
                disabled={readOnly}
                title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
              >
                Cancel Contract
              </Button>
            </ActionWithHelp>
          )}

          {status === 'executed' && signedPdfHref && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewSignedPdf}>
              <Button variant="secondary" className={fabBtn} asChild>
                <a href={signedPdfHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View Signed PDF
                </a>
              </Button>
            </ActionWithHelp>
          )}

          {status === 'error' && isAdmin && (
            <>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewErrorDetails}>
                <Button variant="secondary" className={fabBtn} onClick={() => setOpenErrorDetails(true)}>
                  View Error Details
                </Button>
              </ActionWithHelp>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.resetToDraft}>
                <Button
                  className={fabBtn}
                  onClick={() => {
                    if (!window.confirm('Reset this contract to draft? Internal notes will be cleared.')) return;
                    runAction('reset-error', 'reset-error');
                  }}
                  disabled={busy}
                >
                  {pending && action === 'reset-error' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  Reset to Draft
                </Button>
              </ActionWithHelp>
            </>
          )}
          {/* Secondary DocuSign controls (same unified bottom bar) */}
          {hasDocuSignSecondary && (
            <>
            {canReminder && (
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.sendReminder}>
                <Button
                  className={fabBtn}
                  onClick={() => runAction('send-reminder', 'reminder')}
                  disabled={busy}
                >
                  <Mail className="h-4 w-4" />
                  Send Reminder
                </Button>
              </ActionWithHelp>
            )}
            {canResendWithChanges && (
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.resendWithChanges}>
                <Button
                  variant="outline"
                  className={fabBtn}
                  onClick={() => setOpenResendWithChanges(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  Resend with Changes
                </Button>
              </ActionWithHelp>
            )}
            {canRecall && (
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.recall}>
                <Button
                  variant="outline"
                  className={fabBtn}
                  onClick={() => setOpenRecall(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  Recall Contract
                </Button>
              </ActionWithHelp>
            )}
            {canVoid && (
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.voidContract}>
                <Button
                  variant="destructive"
                  data-tour="contract-void-btn"
                  className={fabBtn}
                  onClick={() => setOpenVoid(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Void Contract
                </Button>
              </ActionWithHelp>
            )}
            </>
          )}

          {canCancelInflightDocuSign && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
              <Button
                variant="outline"
                className={`${fabBtn} text-destructive hover:text-destructive`}
                onClick={() => setOpenCancel(true)}
                disabled={readOnly}
                title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
              >
                Cancel Contract
              </Button>
            </ActionWithHelp>
          )}
        </BottomActionBar>
        </TooltipProvider>

        {/* Status messages when there are no primary row buttons */}
        <StatusLine
          status={status}
          signerEmail={signerEmail}
          signerWaitLabel={signerWaitLabel}
          sentAt={sentAt}
          updatedAt={updatedAt}
          executedAt={executedAt}
          releasedBy={releasedBy}
          releasedAt={releasedAt}
          isAdmin={isAdmin}
          cancelledReason={cancelledReason}
          cancelledAt={cancelledAt}
          cancelledBy={cancelledBy}
          errorDetails={errorDetails}
        />
      </div>

      <Dialog open={openRecall} onOpenChange={setOpenRecall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recall DocuSign contract</DialogTitle>
            <DialogDescription>This voids the in-flight contract and moves this record back to Approved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="recall-reason">Reason (required, 10+ characters)</Label>
            <Textarea id="recall-reason" value={recallReason} onChange={(e) => setRecallReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRecall(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                runAction('recall', 'recall', { reason: recallReason });
                setOpenRecall(false);
              }}
              disabled={busy || recallReason.trim().length < 10}
            >
              {pending && action === 'recall' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Recall Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openApproveDiscount} onOpenChange={setOpenApproveDiscount}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Discounted Rate</DialogTitle>
            <DialogDescription>Confirm this discounted pricing exception so the contract can continue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Exhibitor:</span> {exhibitorName}
            </p>
            <p>
              <span className="text-muted-foreground">Booth rate:</span> {formatCurrency(boothRateCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Booth count:</span> {boothCount}
            </p>
            {lineItemsSubtotalCents > 0 && (
              <>
                <p>
                  <span className="text-muted-foreground">Booth subtotal:</span>{' '}
                  {formatCurrency(boothSubtotalCents)}
                </p>
                <p>
                  <span className="text-muted-foreground">Line items:</span>{' '}
                  {formatCurrency(lineItemsSubtotalCents)}
                </p>
              </>
            )}
            <p>
              <span className="text-muted-foreground">Contract total:</span> {formatCurrency(grandTotalCents)}
            </p>
            <p>
              <span className="text-muted-foreground">Sales rep:</span> {salesRep ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Created by:</span> {createdBy ?? '—'}
            </p>
            <div className="space-y-2">
              <Label htmlFor="discount-reason">Reason (optional)</Label>
              <Textarea
                id="discount-reason"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g., agency comp, multi-year renewal, special relationship..."
                rows={3}
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenApproveDiscount(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                runAction('approve-discount', 'approve-discount', { reason: discountReason.trim() || undefined });
                setOpenApproveDiscount(false);
              }}
              disabled={busy}
            >
              {pending && action === 'approve-discount' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Approve Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openResendWithChanges} onOpenChange={setOpenResendWithChanges}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend with Changes</DialogTitle>
            <DialogDescription>The current DocuSign contract will be voided and a new one will be sent.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resend-signer-name">Signer name</Label>
              <Input id="resend-signer-name" value={nextSignerName} onChange={(e) => setNextSignerName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-signer-email">Signer email</Label>
              <Input id="resend-signer-email" type="email" value={nextSignerEmail} onChange={(e) => setNextSignerEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenResendWithChanges(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                runAction('resend-with-changes', 'resend-with-changes', {
                  signer_1_name: nextSignerName.trim(),
                  signer_1_email: nextSignerEmail.trim(),
                });
                setOpenResendWithChanges(false);
              }}
              disabled={busy || !nextSignerName.trim() || !nextSignerEmail.trim()}
            >
              {pending && action === 'resend-with-changes' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Void and Resend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel contract</DialogTitle>
            <DialogDescription>This is permanent in-app cancellation and cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea id="cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancel(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                runAction('cancel', 'cancel', { reason: cancelReason });
                setOpenCancel(false);
              }}
              disabled={busy || cancelReason.trim().length < 5}
            >
              {pending && action === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel {exhibitorName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openVoid} onOpenChange={setOpenVoid}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void Contract?</DialogTitle>
            <DialogDescription>
              This will void the DocuSign envelope and notify all parties. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason (required, max 100 chars)</Label>
              <Input
                id="void-reason"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value.slice(0, 100))}
                maxLength={100}
                placeholder="e.g., Wrong signer, incorrect amount, duplicate"
              />
              <p className="text-right text-xs text-muted-foreground">{voidReason.length}/100</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who will be notified</p>
              <ul className="space-y-1 text-sm text-foreground/90">
                <li>- {signerName?.trim() || 'Exhibitor signer'} {signerEmail ? `(${signerEmail})` : ''}</li>
                <li>- {countersignerName?.trim() || 'Countersigner'} {countersignerEmail ? `(${countersignerEmail})` : ''}</li>
                <li>- Sales rep: {salesRep ?? salesRepEmail ?? '—'}</li>
                <li>- Events team</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVoid(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                runAction('void', 'void', { reason: voidReason.trim() });
                setOpenVoid(false);
              }}
              disabled={busy || voidReason.trim().length < 5}
            >
              {pending && action === 'void' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Void Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openSendBack} onOpenChange={setOpenSendBack}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back for changes</DialogTitle>
            <DialogDescription>The contract returns to draft for the sales rep. They will receive your notes by email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="send-back-reason">Reason (required, min 10 characters)</Label>
            <Textarea
              id="send-back-reason"
              value={sendBackReason}
              onChange={(e) => setSendBackReason(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSendBack(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                runAction('events-send-back', 'events-send-back', { reason: sendBackReason.trim() });
                setOpenSendBack(false);
              }}
              disabled={busy || sendBackReason.trim().length < 10}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openErrorDetails} onOpenChange={setOpenErrorDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error details</DialogTitle>
            <DialogDescription>Stored on the contract record when send or PDF generation failed.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">{errorDetails ?? '—'}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenErrorDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusLine({
  status,
  signerEmail,
  signerWaitLabel,
  sentAt,
  updatedAt,
  executedAt,
  releasedBy,
  releasedAt,
  isAdmin,
  cancelledReason,
  cancelledAt,
  cancelledBy,
  errorDetails,
}: {
  status: ContractStatus;
  signerEmail: string | null;
  signerWaitLabel: string;
  sentAt: string | null;
  updatedAt: string | null;
  executedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  isAdmin: boolean;
  cancelledReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  errorDetails: string | null;
}) {
  if (status === 'sent') {
    if (!isAdmin) {
      return (
        <p className="text-sm italic text-muted-foreground">
          Waiting for {signerWaitLabel}
          {sentAt ? ` · Sent ${formatRelative(sentAt)}` : ''}
        </p>
      );
    }
    return (
      <p className="text-sm italic text-muted-foreground">
        {sentAt ? `Sent ${formatRelative(sentAt)}` : 'Sent'} · Waiting for {signerEmail ?? 'signer'} to sign
      </p>
    );
  }
  if (status === 'partially_signed') {
    if (!isAdmin) {
      return (
        <p className="text-sm text-muted-foreground">
          Exhibitor signed · Waiting for Shanken countersignature.
        </p>
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        Exhibitor signed {updatedAt ? formatRelative(updatedAt) : 'recently'} · Awaiting Shanken countersignature
      </p>
    );
  }
  if (status === 'signed' && !isAdmin) {
    return <p className="text-sm text-muted-foreground">Awaiting admin release to accounting.</p>;
  }
  if (status === 'executed') {
    return (
      <p className="text-sm text-emerald-700">
        ✓ Released {formatRelative(releasedAt ?? executedAt)}
        {releasedBy ? ` by ${releasedBy}` : ''}
      </p>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p className="font-medium">Contract cancelled</p>
        {cancelledReason && <p>{cancelledReason}</p>}
        <p className="text-xs text-red-700/80">
          {cancelledAt ? formatRelative(cancelledAt) : 'recently'}
          {cancelledBy ? ` by ${cancelledBy}` : ''}
        </p>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p className="font-medium">Error sending contract</p>
        <p>{errorDetails ?? 'Contract is in an error state. Check activity for details.'}</p>
      </div>
    );
  }
  return null;
}
