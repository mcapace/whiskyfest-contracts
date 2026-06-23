'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { emitContractActionSuccessFeedback } from '@/lib/contract-action-feedback';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Repeat2,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react';
import { ActionWithHelp } from '@/components/contract/action-with-help';
import {
  ContractActionButtonLabel,
  contractActionBtnDanger,
  contractActionBtnPrimary,
  contractActionBtnSecondary,
} from '@/components/contract/contract-action-bar';
import {
  ContractActionsSidebar,
  ContractActionsSidebarGroup,
  useContractActionsSidebar,
} from '@/components/contract/contract-actions-sidebar';
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
import { formatCurrency } from '@/lib/utils';
import { useRelativeTimeLabel } from '@/components/ui/relative-time';
import { useContractLiveOptional } from '@/components/contracts/contract-live-context';
import type { ContractStatus } from '@/types/db';

const DISCOUNT_ACTION_BLOCKED = 'Discount approval required first';

/** Wraps actions blocked server-side when `requiresDiscountApproval`; tooltip explains why (disabled buttons do not receive hover). */
function WhenDiscountBlocks({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-not-allowed items-center rounded-lg">{children}</span>
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
  /** NYWE and other events-managed workflows let events team release signed contracts. */
  eventsManagedWorkflow?: boolean;
  /** When false, DocuSign send is blocked for this event (internal prep). */
  clientSendEnabled?: boolean;
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
  eventsManagedWorkflow = false,
  clientSendEnabled = true,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const contractLive = useContractLiveOptional();
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
  const [openReleaseAccounting, setOpenReleaseAccounting] = useState(false);
  const [sendBackReason, setSendBackReason] = useState('');
  const [recallReason, setRecallReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [nextSignerName, setNextSignerName] = useState(signerName ?? '');
  const [nextSignerEmail, setNextSignerEmail] = useState(signerEmail ?? '');

  async function submitRecall() {
    setAction('recall');
    if (contractLive) contractLive.setOptimisticStatus('draft');
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: recallReason.trim() }),
      });
      if (res.ok) {
        contractLive?.setOptimisticStatus(null);
        emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
        setOpenRecall(false);
        setRecallReason('');
        router.push(`/contracts/${contractId}/edit`);
        router.refresh();
      } else {
        contractLive?.setOptimisticStatus(null);
        const j = await res.json().catch(() => ({}));
        alert(`Recall failed: ${j.error ?? res.status}`);
      }
      setAction(null);
    });
  }

  async function runAction(
    path: string,
    actionName: string,
    body?: Record<string, unknown>,
    optimisticNextStatus?: ContractStatus,
  ) {
    setAction(actionName);
    if (optimisticNextStatus && contractLive) {
      contractLive.setOptimisticStatus(optimisticNextStatus);
    }
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/${path}`, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) {
        contractLive?.setOptimisticStatus(null);
        emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
        router.refresh();
        queueMicrotask(() => router.refresh());
      } else {
        contractLive?.setOptimisticStatus(null);
        const j = await res.json().catch(() => ({}));
        alert(`Action failed: ${j.error ?? res.status}`);
      }
      setAction(null);
    });
  }

  async function syncFromDocuSign() {
    setAction('sync-docusign');
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/sync-docusign`, { method: 'POST' });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        changed?: boolean;
      };
      if (res.ok) {
        emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
        alert(j.message ?? (j.changed ? 'Synced from DocuSign.' : 'No change needed.'));
        router.refresh();
        queueMicrotask(() => router.refresh());
      } else {
        alert(`Sync failed: ${j.error ?? res.status}`);
      }
      setAction(null);
    });
  }

  const canReminder = isAdmin && (status === 'sent' || status === 'partially_signed') && Boolean(docusignEnvelopeId);
  const canRecall =
    (isAdmin || isEventsTeam) &&
    (status === 'sent' || status === 'partially_signed') &&
    Boolean(docusignEnvelopeId);
  const canResendWithChanges = canReminder && !discountApprovalPending;
  const canVoid =
    (isAdmin || isEventsTeam) &&
    (status === 'sent' || status === 'partially_signed') &&
    Boolean(docusignEnvelopeId);
  const canSyncDocuSign =
    (isAdmin || isEventsTeam) &&
    Boolean(docusignEnvelopeId) &&
    (status === 'sent' || status === 'partially_signed' || status === 'error');
  /** In-flight DocuSign: reminder / recall / resend-with-changes / void / sync */
  const hasDocuSignSecondary =
    canReminder || canResendWithChanges || canRecall || canVoid || canSyncDocuSign;
  /** Cancel contract while envelope is out (API allows cancel except executed/cancelled). */
  const canCancelInflightDocuSign =
    (status === 'sent' || status === 'partially_signed') && (isAdmin || isEventsTeam);
  const canCancelSigned = status === 'signed' && (isAdmin || isEventsTeam);
  const canRelease = status === 'signed' && (isAdmin || (isEventsTeam && eventsManagedWorkflow));
  const canReleaseImported = status === 'imported' && (isAdmin || isEventsTeam) && !discountApprovalPending;
  const canEditImported = status === 'imported' && (isAdmin || isEventsTeam);
  const canEditVoided = status === 'voided' && (isAdmin || isEventsTeam);
  const canVoidImported = status === 'imported' && (isAdmin || isEventsTeam);
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
    if (canRelease || canReleaseImported || canCancelSigned) return true;
    if (canEditVoided) return true;
    if (status === 'imported' && (signedPdfHref || canEditImported || canVoidImported)) return true;
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
    canReleaseImported,
    canEditImported,
    canEditVoided,
    canVoidImported,
    canCancelSigned,
    signedPdfHref,
  ]);

  const btnPrimary = contractActionBtnPrimary;
  const btnSecondary = contractActionBtnSecondary;
  const btnDanger = contractActionBtnDanger;
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useContractActionsSidebar(false);

  return (
    <>
      <div className="space-y-5">
        <TooltipProvider delayDuration={300} skipDelayDuration={200}>
          <ContractActionsSidebar
            visible={fabVisible}
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
          >
          {status === 'draft' && (
            <>
              <WhenDiscountBlocks active={discountApprovalPending}>
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.generateDraftPdf}>
                  <Button
                    className={btnPrimary}
                    onClick={() => runAction('generate', 'generate')}
                    disabled={busy || discountApprovalPending}
                  >
                    <ContractActionButtonLabel
                      icon={FileText}
                      label="Generate Draft PDF"
                      spinning={pending && action === 'generate'}
                    />
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              {readOnly ? (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.editContract}>
                  <Button
                    type="button"
                    className={btnSecondary}
                    disabled
                    title={IMPERSONATION_BUTTON_TOOLTIP}
                  >
                    <ContractActionButtonLabel icon={Pencil} label="Edit Contract" />
                  </Button>
                </ActionWithHelp>
              ) : (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.editContract}>
                  <Button className={btnSecondary} asChild>
                    <Link href={`/contracts/${contractId}/edit`}>
                      <ContractActionButtonLabel icon={Pencil} label="Edit Contract" />
                    </Link>
                  </Button>
                </ActionWithHelp>
              )}
              {isAdmin && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                  <Button
                    className={btnDanger}
                    onClick={() => setOpenCancel(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel icon={XCircle} label="Cancel Contract" />
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
                  className={`${contractActionBtnPrimary} border-amber-600 bg-amber-600 text-white hover:bg-amber-700`}
                  onClick={() => setOpenApproveDiscount(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  <ContractActionButtonLabel icon={AlertTriangle} label="Approve Discount" />
                </Button>
              </ActionWithHelp>
              <WhenDiscountBlocks active={discountApprovalPending}>
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.regeneratePdf}>
                  <Button
                    className={btnSecondary}
                    onClick={() => runAction('generate', 'regenerate')}
                    disabled={busy || discountApprovalPending}
                  >
                    <ContractActionButtonLabel
                      icon={RefreshCw}
                      label="Re-generate PDF"
                      spinning={pending && action === 'regenerate'}
                    />
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                <Button
                  className={btnDanger}
                  onClick={() => setOpenCancel(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  <ContractActionButtonLabel icon={XCircle} label="Cancel Contract" />
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
                    className={btnSecondary}
                    onClick={() => runAction('generate', 'regenerate')}
                    disabled={busy || discountApprovalPending}
                  >
                    <ContractActionButtonLabel
                      icon={RefreshCw}
                      label="Re-generate PDF"
                      spinning={pending && action === 'regenerate'}
                    />
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.approveForSendingDisabled}>
                  <Button
                    className={btnSecondary}
                    disabled
                  title={DISCOUNT_ACTION_BLOCKED}
                >
                  <ContractActionButtonLabel icon={Send} label="Approve for Sending" />
                </Button>
              </ActionWithHelp>
            </>
          )}

          {status === 'ready_for_review' && !discountApprovalPending && (
            <>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.regeneratePdf}>
                <Button
                  className={btnSecondary}
                  onClick={() => runAction('generate', 'regenerate')}
                  disabled={busy}
                >
                  <ContractActionButtonLabel icon={RefreshCw} label="Re-generate PDF (submit for events review)" />
                </Button>
              </ActionWithHelp>
              {isAdmin && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                  <Button
                    className={btnDanger}
                    onClick={() => setOpenCancel(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel icon={XCircle} label="Cancel Contract" />
                  </Button>
                </ActionWithHelp>
              )}
            </>
          )}

          {status === 'pending_events_review' && !discountApprovalPending && isEventsTeam && (
            <>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.approveContract}>
                <Button
                  className={btnPrimary}
                  onClick={() => runAction('events-approve', 'events-approve', {}, 'approved')}
                  disabled={busy}
                >
                  <ContractActionButtonLabel
                    icon={CheckCircle2}
                    label="Approve Contract"
                    spinning={pending && action === 'events-approve'}
                  />
                </Button>
              </ActionWithHelp>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.sendBack}>
                <Button
                  className={btnSecondary}
                  onClick={() => setOpenSendBack(true)}
                  disabled={readOnly}
                  title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                >
                  <ContractActionButtonLabel icon={Undo2} label="Send Back for Changes" />
                </Button>
              </ActionWithHelp>
              {draftPdfHref && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewDraftPdf}>
                  <Button className={btnSecondary} asChild>
                    <a href={draftPdfHref} target="_blank" rel="noreferrer">
                      <ContractActionButtonLabel icon={ExternalLink} label="View Draft PDF" />
                    </a>
                  </Button>
                </ActionWithHelp>
              )}
            </>
          )}

          {status === 'pending_events_review' && !discountApprovalPending && !isEventsTeam && isAdmin && draftPdfHref && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewDraftPdf}>
              <Button className={btnSecondary} asChild>
                <a href={draftPdfHref} target="_blank" rel="noreferrer">
                  <ContractActionButtonLabel icon={ExternalLink} label="View Draft PDF" />
                </a>
              </Button>
            </ActionWithHelp>
          )}

          {status === 'approved' && (
            <>
              <WhenDiscountBlocks active={discountApprovalPending || !clientSendEnabled}>
                <ActionWithHelp
                  helpText={
                    clientSendEnabled
                      ? CONTRACT_ACTION_HELP.sendViaDocusign
                      : 'Client send is disabled for this event. Prepare contracts internally until send is enabled in Events admin.'
                  }
                >
                  <Button
                    className={btnPrimary}
                    onClick={() => runAction('send', 'send', undefined, 'sent')}
                    disabled={busy || discountApprovalPending || !clientSendEnabled}
                  >
                    <ContractActionButtonLabel
                      icon={Send}
                      label={clientSendEnabled ? 'Send via DocuSign' : 'Send disabled'}
                      spinning={pending && action === 'send'}
                    />
                  </Button>
                </ActionWithHelp>
              </WhenDiscountBlocks>
              {isAdmin && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
                  <Button
                    className={btnDanger}
                    onClick={() => setOpenCancel(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel icon={XCircle} label="Cancel Contract" />
                  </Button>
                </ActionWithHelp>
              )}
            </>
          )}

          {canRelease && (
            <WhenDiscountBlocks active={discountApprovalPending}>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.releaseToAccounting}>
                <Button
                  className={btnPrimary}
                  onClick={() =>
                    eventsManagedWorkflow
                      ? setOpenReleaseAccounting(true)
                      : runAction('release', 'release', undefined, 'executed')
                  }
                  disabled={busy || discountApprovalPending}
                >
                  <ContractActionButtonLabel
                    icon={CheckCircle2}
                    label="Release to Accounting"
                    spinning={pending && action === 'release'}
                  />
                </Button>
              </ActionWithHelp>
            </WhenDiscountBlocks>
          )}

          {status === 'imported' && signedPdfHref && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewSignedPdf}>
              <Button className={btnSecondary} asChild>
                <a href={signedPdfHref} target="_blank" rel="noreferrer">
                  <ContractActionButtonLabel icon={ExternalLink} label="View signed PDF" />
                </a>
              </Button>
            </ActionWithHelp>
          )}

          {canReleaseImported && (
            <WhenDiscountBlocks active={discountApprovalPending}>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.releaseImported}>
                <Button
                  className={btnPrimary}
                  onClick={() => runAction('release', 'release', undefined, 'executed')}
                  disabled={busy || discountApprovalPending}
                >
                  <ContractActionButtonLabel
                    icon={CheckCircle2}
                    label="Release to Accounting"
                    spinning={pending && action === 'release'}
                  />
                </Button>
              </ActionWithHelp>
            </WhenDiscountBlocks>
          )}

          {canEditImported && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.editImportedContract}>
              <Button className={btnSecondary} asChild>
                <Link href={`/contracts/${contractId}/edit`}>
                  <ContractActionButtonLabel icon={Pencil} label="Edit imported details" />
                </Link>
              </Button>
            </ActionWithHelp>
          )}

          {canVoidImported && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.voidImportedRecord}>
              <Button
                className={btnDanger}
                onClick={() => setOpenVoid(true)}
                disabled={readOnly}
                title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
              >
                <ContractActionButtonLabel icon={AlertTriangle} label="Void record" />
              </Button>
            </ActionWithHelp>
          )}

          {canCancelSigned && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel}>
              <Button
                className={btnDanger}
                onClick={() => setOpenCancel(true)}
                disabled={readOnly}
                title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
              >
                <ContractActionButtonLabel icon={XCircle} label="Cancel Contract" />
              </Button>
            </ActionWithHelp>
          )}

          {canEditVoided && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.editVoidedContract}>
              <Button className={btnSecondary} asChild>
                <Link href={`/contracts/${contractId}/edit`}>
                  <ContractActionButtonLabel icon={Repeat2} label="Edit and re-send" />
                </Link>
              </Button>
            </ActionWithHelp>
          )}

          {status === 'executed' && signedPdfHref && (
            <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewSignedPdf}>
              <Button className={btnSecondary} asChild>
                <a href={signedPdfHref} target="_blank" rel="noreferrer">
                  <ContractActionButtonLabel icon={ExternalLink} label="View Signed PDF" />
                </a>
              </Button>
            </ActionWithHelp>
          )}

          {status === 'error' && isAdmin && (
            <>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.viewErrorDetails}>
                <Button className={btnSecondary} onClick={() => setOpenErrorDetails(true)}>
                  <ContractActionButtonLabel icon={CircleAlert} label="View Error Details" />
                </Button>
              </ActionWithHelp>
              <ActionWithHelp helpText={CONTRACT_ACTION_HELP.resetToDraft}>
                <Button
                  className={btnPrimary}
                  onClick={() => {
                    if (!window.confirm('Reset this contract to draft? Internal notes will be cleared.')) return;
                    runAction('reset-error', 'reset-error', undefined, 'draft');
                  }}
                  disabled={busy}
                >
                  <ContractActionButtonLabel
                    icon={Undo2}
                    label="Reset to Draft"
                    spinning={pending && action === 'reset-error'}
                  />
                </Button>
              </ActionWithHelp>
            </>
          )}
          {hasDocuSignSecondary && (
            <ContractActionsSidebarGroup label="DocuSign">
              {canReminder && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.sendReminder} className="w-full">
                  <Button
                    className={btnPrimary}
                    onClick={() => runAction('send-reminder', 'reminder')}
                    disabled={busy}
                  >
                    <ContractActionButtonLabel
                      icon={Mail}
                      label="Send Reminder"
                      spinning={pending && action === 'reminder'}
                    />
                  </Button>
                </ActionWithHelp>
              )}
              {canSyncDocuSign && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.syncFromDocusign} className="w-full">
                  <Button
                    className={btnSecondary}
                    onClick={() => syncFromDocuSign()}
                    disabled={busy || readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel
                      icon={RefreshCw}
                      label="Sync from DocuSign"
                      spinning={pending && action === 'sync-docusign'}
                    />
                  </Button>
                </ActionWithHelp>
              )}
              {canResendWithChanges && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.resendWithChanges} className="w-full">
                  <Button
                    className={btnSecondary}
                    onClick={() => setOpenResendWithChanges(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel icon={Repeat2} label="Resend with Changes" />
                  </Button>
                </ActionWithHelp>
              )}
              {canRecall && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.recall} className="w-full">
                  <Button
                    className={btnSecondary}
                    onClick={() => setOpenRecall(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel icon={Undo2} label="Recall Contract" />
                  </Button>
                </ActionWithHelp>
              )}
              {canVoid && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.voidContract} className="w-full">
                  <Button
                    data-tour="contract-void-btn"
                    className={btnDanger}
                    onClick={() => setOpenVoid(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel icon={AlertTriangle} label="Void Contract" />
                  </Button>
                </ActionWithHelp>
              )}
              {canCancelInflightDocuSign && (
                <ActionWithHelp helpText={CONTRACT_ACTION_HELP.cancel} className="w-full">
                  <Button
                    className={btnDanger}
                    onClick={() => setOpenCancel(true)}
                    disabled={readOnly}
                    title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}
                  >
                    <ContractActionButtonLabel icon={XCircle} label="Cancel Contract" />
                  </Button>
                </ActionWithHelp>
              )}
            </ContractActionsSidebarGroup>
          )}
        </ContractActionsSidebar>
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
          isEventsTeam={isEventsTeam}
          eventsManagedWorkflow={eventsManagedWorkflow}
          docusignEnvelopeId={docusignEnvelopeId}
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
            <DialogDescription>
              Recalling will invalidate the DocuSign envelope and return this contract to <strong>draft</strong> so you
              can edit booths, brands, pricing, and signer details. Any signatures already made will not count. Use this
              when you need to fix details before re-sending.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="recall-reason">Reason (required, 10+ characters)</Label>
            <Textarea id="recall-reason" value={recallReason} onChange={(e) => setRecallReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRecall(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitRecall()} disabled={busy || recallReason.trim().length < 10}>
              {pending && action === 'recall' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Recall to draft
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
                runAction(
                  'resend-with-changes',
                  'resend-with-changes',
                  {
                    signer_1_name: nextSignerName.trim(),
                    signer_1_email: nextSignerEmail.trim(),
                  },
                  'approved',
                );
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
                runAction('cancel', 'cancel', { reason: cancelReason }, 'cancelled');
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
            <DialogTitle>{status === 'imported' ? 'Void imported record?' : 'Void Contract?'}</DialogTitle>
            <DialogDescription>
              {status === 'imported' ? (
                <>
                  This permanently marks the imported contract <strong>voided</strong>. Use only when this legacy deal
                  should not remain in the pipeline. PDFs stay in storage for audit unless removed separately.
                </>
              ) : (
                <>
                  Voiding permanently invalidates this DocuSign envelope and marks the contract <strong>voided</strong>.
                  Use this only when the deal is off and will not be revived. To fix terms and re-send, use{' '}
                  <strong>Recall</strong> instead.
                </>
              )}
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
            {status !== 'imported' ? (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Who will be notified</p>
                <ul className="space-y-1 text-sm text-foreground/90">
                  <li>- {signerName?.trim() || 'Exhibitor signer'} {signerEmail ? `(${signerEmail})` : ''}</li>
                  <li>- {countersignerName?.trim() || 'Countersigner'} {countersignerEmail ? `(${countersignerEmail})` : ''}</li>
                  <li>- Sales rep: {salesRep ?? salesRepEmail ?? '—'}</li>
                  <li>- Events team</li>
                </ul>
              </div>
            ) : (
              <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-foreground/85">
                Notifications follow the standard void flow (sales rep and events team where configured).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVoid(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                runAction('void', 'void', { reason: voidReason.trim() }, 'voided');
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
                runAction('events-send-back', 'events-send-back', { reason: sendBackReason.trim() }, 'draft');
                setOpenSendBack(false);
              }}
              disabled={busy || sendBackReason.trim().length < 10}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openReleaseAccounting} onOpenChange={setOpenReleaseAccounting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to accounting?</DialogTitle>
            <DialogDescription>
              Release <strong>{exhibitorName}</strong> to accounts receivable. Accounting will receive an email with the
              signed PDF and billing details.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpenReleaseAccounting(false)} disabled={busy}>
              Not yet
            </Button>
            <Button
              onClick={() => {
                setOpenReleaseAccounting(false);
                runAction('release', 'release', undefined, 'executed');
              }}
              disabled={busy}
            >
              Yes, send to accounting
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
  isEventsTeam,
  eventsManagedWorkflow,
  docusignEnvelopeId,
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
  isEventsTeam: boolean;
  eventsManagedWorkflow: boolean;
  docusignEnvelopeId: string | null;
  cancelledReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  errorDetails: string | null;
}) {
  const sentRelative = useRelativeTimeLabel(sentAt);
  const updatedRelative = useRelativeTimeLabel(updatedAt);
  const releasedRelative = useRelativeTimeLabel(releasedAt ?? executedAt);
  const cancelledRelative = useRelativeTimeLabel(cancelledAt);

  if (status === 'sent') {
    if (!isAdmin) {
      return (
        <p className="text-sm italic text-muted-foreground" suppressHydrationWarning>
          Waiting for {signerWaitLabel}
          {sentAt ? ` · Sent ${sentRelative}` : ''}
        </p>
      );
    }
    return (
      <p className="text-sm italic text-muted-foreground" suppressHydrationWarning>
        {sentAt ? `Sent ${sentRelative}` : 'Sent'} · Waiting for {signerEmail ?? 'signer'} to sign
        {(isAdmin || isEventsTeam) && docusignEnvelopeId ? (
          <> · If they already signed in DocuSign, open <span className="font-medium text-foreground">Actions</span> and use Sync from DocuSign.</>
        ) : null}
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
      <p className="text-sm text-muted-foreground" suppressHydrationWarning>
        Exhibitor signed {updatedAt ? updatedRelative : 'recently'} · Awaiting Shanken countersignature
      </p>
    );
  }
  if (status === 'signed' && !isAdmin && !(isEventsTeam && eventsManagedWorkflow)) {
    return <p className="text-sm text-muted-foreground">Awaiting admin release to accounting.</p>;
  }
  if (status === 'imported') {
    return (
      <p className="text-sm text-muted-foreground">
        Legacy agreement on file — release to accounting when AR should pick this up for invoicing.
      </p>
    );
  }
  if (status === 'executed') {
    return (
      <p className="text-sm text-emerald-700" suppressHydrationWarning>
        ✓ Released {releasedRelative}
        {releasedBy ? ` by ${releasedBy}` : ''}
      </p>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p className="font-medium">Contract cancelled</p>
        {cancelledReason && <p>{cancelledReason}</p>}
        <p className="text-xs text-red-700/80" suppressHydrationWarning>
          {cancelledAt ? cancelledRelative : 'recently'}
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
        {(isAdmin || isEventsTeam) && docusignEnvelopeId ? (
          <p className="mt-1 text-xs text-red-700/90">
            If DocuSign shows signatures completed, open Actions and use Sync from DocuSign.
          </p>
        ) : null}
      </div>
    );
  }
  return null;
}
