'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, FileText, Loader2, Mail, MoreHorizontal, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, formatRelative } from '@/lib/utils';
import type { ContractStatus } from '@/types/db';

interface Props {
  contractId:    string;
  exhibitorName: string;
  signerEmail: string | null;
  signerName: string | null;
  status:        ContractStatus;
  draftPdfUrl:   string | null;
  signedPdfUrl:  string | null;
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
  salesRep: string | null;
  createdBy: string | null;
  discountApprovalPending: boolean;
}

export function ContractActions({
  contractId,
  exhibitorName,
  signerEmail,
  signerName,
  status,
  draftPdfUrl,
  signedPdfUrl,
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
  salesRep,
  createdBy,
  discountApprovalPending,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const [openRecall, setOpenRecall] = useState(false);
  const [openResendWithChanges, setOpenResendWithChanges] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [openApproveDiscount, setOpenApproveDiscount] = useState(false);
  const [recallReason, setRecallReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
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

  const isTerminal = status === 'cancelled' || status === 'executed' || status === 'error';
  const canCancel = !isTerminal && isAdmin;
  const canReminder = isAdmin && (status === 'sent' || status === 'partially_signed') && Boolean(docusignEnvelopeId);
  const canRecall = canReminder;
  const canResendWithChanges = canReminder && !discountApprovalPending;
  const canRelease = status === 'signed' && isAdmin;
  const canApproveDiscount = isAdmin && discountApprovalPending;

  const progress = useMemo(() => getProgress(status), [status]);

  const primaryAction = useMemo(() => {
    if (status === 'draft') return { label: 'Generate Draft PDF', path: 'generate', key: 'generate', icon: FileText };
    if (status === 'ready_for_review') return { label: 'Approve for Sending', path: 'approve', key: 'approve', icon: CheckCircle2 };
    if (status === 'approved') return { label: 'Send via DocuSign', path: 'send', key: 'send', icon: Send };
    if (canRelease) return { label: 'Release to Accounting', path: 'release', key: 'release', icon: CheckCircle2 };
    return null;
  }, [status, canRelease]);
  const primaryBlockedForDiscount =
    discountApprovalPending &&
    !!primaryAction &&
    (primaryAction.key === 'approve' || primaryAction.key === 'send' || primaryAction.key === 'release');

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ProgressState progress={progress} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {draftPdfUrl && (
                <DropdownMenuItem asChild>
                  <a href={draftPdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" /> View Draft PDF
                  </a>
                </DropdownMenuItem>
              )}
              {signedPdfUrl && (
                <DropdownMenuItem asChild>
                  <a href={signedPdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" /> View Signed PDF
                  </a>
                </DropdownMenuItem>
              )}
              {(draftPdfUrl || signedPdfUrl) && (canReminder || canResendWithChanges || canRecall || canCancel || status === 'ready_for_review') && (
                <DropdownMenuSeparator />
              )}
              {status === 'ready_for_review' && (
                <DropdownMenuItem onClick={() => runAction('generate', 'regenerate')}>
                  <FileText className="mr-2 h-4 w-4" /> Re-generate PDF
                </DropdownMenuItem>
              )}
              {canReminder && (
                <DropdownMenuItem onClick={() => runAction('send-reminder', 'reminder')}>
                  <Mail className="mr-2 h-4 w-4" /> Send Reminder
                </DropdownMenuItem>
              )}
              {canResendWithChanges && (
                <DropdownMenuItem onClick={() => setOpenResendWithChanges(true)}>
                  Resend with Changes
                </DropdownMenuItem>
              )}
              {canApproveDiscount && (
                <DropdownMenuItem onClick={() => setOpenApproveDiscount(true)}>
                  Approve Discount...
                </DropdownMenuItem>
              )}
              {canRecall && (
                <DropdownMenuItem onClick={() => setOpenRecall(true)}>Recall</DropdownMenuItem>
              )}
              {canCancel && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setOpenCancel(true)}>
                    Cancel Contract
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="min-h-[2.5rem]">
          {primaryAction ? (
            <div className="space-y-2">
              <div title={primaryBlockedForDiscount ? 'Discount approval required' : undefined} className="inline-block">
                <Button
                  onClick={() => runAction(primaryAction.path, primaryAction.key)}
                  disabled={pending || primaryBlockedForDiscount}
                >
                  {pending && action === primaryAction.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <primaryAction.icon className="h-4 w-4" />
                  )}
                  {primaryAction.label}
                </Button>
              </div>
              {primaryBlockedForDiscount && (
                <p className="text-xs text-amber-700">Discount approval required before this action is available.</p>
              )}
              {status === 'ready_for_review' && (
                <button
                  type="button"
                  className="block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                  onClick={() => runAction('generate', 'regenerate')}
                  disabled={pending}
                >
                  Re-generate PDF
                </button>
              )}
            </div>
          ) : (
            <StatusLine
              status={status}
              signerEmail={signerEmail}
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
          )}
        </div>
      </div>

      <Dialog open={openRecall} onOpenChange={setOpenRecall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recall DocuSign contract</DialogTitle>
            <DialogDescription>
              This voids the in-flight contract and moves this record back to Approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="recall-reason">Reason (required, 10+ characters)</Label>
            <Textarea
              id="recall-reason"
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRecall(false)}>Cancel</Button>
            <Button
              onClick={() => {
                runAction('recall', 'recall', { reason: recallReason });
                setOpenRecall(false);
              }}
              disabled={pending || recallReason.trim().length < 10}
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
            <DialogDescription>
              Confirm this discounted pricing exception so the contract can continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Exhibitor:</span> {exhibitorName}</p>
            <p><span className="text-muted-foreground">Booth rate:</span> {formatCurrency(boothRateCents)}</p>
            <p><span className="text-muted-foreground">Booth count:</span> {boothCount}</p>
            <p><span className="text-muted-foreground">Grand total:</span> {formatCurrency(grandTotalCents)}</p>
            <p><span className="text-muted-foreground">Sales rep:</span> {salesRep ?? '—'}</p>
            <p><span className="text-muted-foreground">Created by:</span> {createdBy ?? '—'}</p>
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
            <Button variant="outline" onClick={() => setOpenApproveDiscount(false)}>Cancel</Button>
            <Button
              onClick={() => {
                runAction('approve-discount', 'approve-discount', { reason: discountReason.trim() || undefined });
                setOpenApproveDiscount(false);
              }}
              disabled={pending}
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
            <DialogDescription>
              The current DocuSign contract will be voided and a new one will be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resend-signer-name">Signer name</Label>
              <Input
                id="resend-signer-name"
                value={nextSignerName}
                onChange={(e) => setNextSignerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-signer-email">Signer email</Label>
              <Input
                id="resend-signer-email"
                type="email"
                value={nextSignerEmail}
                onChange={(e) => setNextSignerEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenResendWithChanges(false)}>Cancel</Button>
            <Button
              onClick={() => {
                runAction('resend-with-changes', 'resend-with-changes', {
                  signer_1_name: nextSignerName.trim(),
                  signer_1_email: nextSignerEmail.trim(),
                });
                setOpenResendWithChanges(false);
              }}
              disabled={pending || !nextSignerName.trim() || !nextSignerEmail.trim()}
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
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCancel(false)}>Back</Button>
            <Button
              variant="destructive"
              onClick={() => {
                runAction('cancel', 'cancel', { reason: cancelReason });
                setOpenCancel(false);
              }}
              disabled={pending || cancelReason.trim().length < 5}
            >
              {pending && action === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancel {exhibitorName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const STAGES: Array<{ key: Exclude<ContractStatus, 'cancelled' | 'error'>; label: string }> = [
  { key: 'draft', label: 'Draft' },
  { key: 'ready_for_review', label: 'Ready' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent', label: 'Sent' },
  { key: 'partially_signed', label: 'Partially Signed' },
  { key: 'signed', label: 'Fully Signed' },
  { key: 'executed', label: 'Executed' },
];

function getProgress(status: ContractStatus): { special: string | null; currentIdx: number } {
  if (status === 'cancelled') return { special: 'cancelled', currentIdx: -1 };
  if (status === 'error') return { special: 'error', currentIdx: -1 };
  const idx = STAGES.findIndex((s) => s.key === status);
  return { special: null, currentIdx: Math.max(idx, 0) };
}

function ProgressState({ progress }: { progress: { special: string | null; currentIdx: number } }) {
  if (progress.special === 'cancelled') {
    return <p className="text-sm font-medium text-red-600">✗ Cancelled</p>;
  }
  if (progress.special === 'error') {
    return <p className="text-sm font-medium text-red-600">⚠ Error</p>;
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1">
        {STAGES.map((stage, idx) => (
          <div key={stage.key} className="flex items-center gap-1">
            <span
              className={`h-2.5 w-2.5 rounded-full border ${
                idx === progress.currentIdx
                  ? 'border-fest-700 bg-fest-700'
                  : idx < progress.currentIdx
                  ? 'border-fest-700 bg-fest-100'
                  : 'border-muted-foreground/40 bg-background'
              }`}
            />
            {idx < STAGES.length - 1 && (
              <span className={`h-px flex-1 border-t border-dotted ${idx < progress.currentIdx ? 'border-fest-700' : 'border-muted-foreground/40'}`} />
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground">
        {STAGES.map((stage) => (
          <span key={stage.key}>{stage.label}</span>
        ))}
      </div>
    </div>
  );
}

function StatusLine({
  status,
  signerEmail,
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
    return (
      <p className="text-sm italic text-muted-foreground">
        {sentAt ? `Sent ${formatRelative(sentAt)}` : 'Sent'} · Waiting for {signerEmail ?? 'signer'} to sign
      </p>
    );
  }
  if (status === 'partially_signed') {
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
        ✓ Released {formatRelative(releasedAt ?? executedAt)}{releasedBy ? ` by ${releasedBy}` : ''}
      </p>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        <p className="font-medium">Contract cancelled</p>
        {cancelledReason && <p>{cancelledReason}</p>}
        <p className="text-xs text-red-700/80">
          {cancelledAt ? formatRelative(cancelledAt) : 'recently'}{cancelledBy ? ` by ${cancelledBy}` : ''}
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
