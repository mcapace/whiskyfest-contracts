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
import { formatRelative } from '@/lib/utils';
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
  executedAt: string | null;
  cancelledReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  isAdmin: boolean;
  releasedBy: string | null;
  releasedAt: string | null;
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
  executedAt,
  cancelledReason,
  cancelledAt,
  cancelledBy,
  isAdmin,
  releasedBy,
  releasedAt,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const [openRecall, setOpenRecall] = useState(false);
  const [openResendWithChanges, setOpenResendWithChanges] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [recallReason, setRecallReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
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
  const canResendWithChanges = canReminder;
  const canRelease = status === 'signed' && isAdmin;

  const progress = useMemo(() => getProgress(status), [status]);

  const primaryAction = useMemo(() => {
    if (status === 'draft') return { label: 'Generate Draft PDF', path: 'generate', key: 'generate', icon: FileText };
    if (status === 'ready_for_review') return { label: 'Approve for Sending', path: 'approve', key: 'approve', icon: CheckCircle2 };
    if (status === 'approved') return { label: 'Send via DocuSign', path: 'send', key: 'send', icon: Send };
    if (canRelease) return { label: 'Release to Accounting', path: 'release', key: 'release', icon: CheckCircle2 };
    return null;
  }, [status, canRelease]);

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
            <Button onClick={() => runAction(primaryAction.path, primaryAction.key)} disabled={pending}>
              {pending && action === primaryAction.key ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <primaryAction.icon className="h-4 w-4" />
              )}
              {primaryAction.label}
            </Button>
          ) : (
            <StatusLine
              status={status}
              signerEmail={signerEmail}
              sentAt={sentAt}
              executedAt={executedAt}
              releasedBy={releasedBy}
              releasedAt={releasedAt}
              isAdmin={isAdmin}
              cancelledReason={cancelledReason}
              cancelledAt={cancelledAt}
              cancelledBy={cancelledBy}
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
                idx <= progress.currentIdx
                  ? 'border-fest-700 bg-fest-700'
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
  executedAt,
  releasedBy,
  releasedAt,
  isAdmin,
  cancelledReason,
  cancelledAt,
  cancelledBy,
}: {
  status: ContractStatus;
  signerEmail: string | null;
  sentAt: string | null;
  executedAt: string | null;
  releasedBy: string | null;
  releasedAt: string | null;
  isAdmin: boolean;
  cancelledReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
}) {
  if (status === 'sent') {
    return (
      <p className="text-sm text-muted-foreground">
        Waiting for {signerEmail ?? 'signer'}{sentAt ? ` — sent ${formatRelative(sentAt)}` : ''}
      </p>
    );
  }
  if (status === 'partially_signed') {
    return <p className="text-sm text-muted-foreground">Exhibitor signed. Awaiting Shanken countersignature.</p>;
  }
  if (status === 'signed' && !isAdmin) {
    return <p className="text-sm text-muted-foreground">Awaiting admin release to accounting.</p>;
  }
  if (status === 'executed') {
    return (
      <p className="text-sm text-emerald-700">
        ✓ Released to accounting {formatRelative(releasedAt ?? executedAt)}{releasedBy ? ` by ${releasedBy}` : ''}
      </p>
    );
  }
  if (status === 'cancelled') {
    return (
      <p className="text-sm text-red-600">
        Contract cancelled{cancelledReason ? `: ${cancelledReason}` : ''}{cancelledAt ? ` (${formatRelative(cancelledAt)})` : ''}{cancelledBy ? ` by ${cancelledBy}` : ''}
      </p>
    );
  }
  if (status === 'error') {
    return <p className="text-sm text-red-600">Contract is in an error state. Check activity for details.</p>;
  }
  return null;
}
