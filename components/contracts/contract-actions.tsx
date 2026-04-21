'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Send, CheckCircle2, ExternalLink, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CancelContractDialog } from '@/components/contracts/cancel-contract-dialog';
import { RecallDocusignDialog } from '@/components/contracts/recall-docusign-dialog';
import type { ContractStatus } from '@/types/db';

interface Props {
  contractId:    string;
  exhibitorName: string;
  status:        ContractStatus;
  draftPdfUrl:   string | null;
  signedPdfUrl:  string | null;
  /** Set when a DocuSign envelope exists (sent / partially signed). */
  docusignEnvelopeId?: string | null;
}

export function ContractActions({
  contractId,
  exhibitorName,
  status,
  draftPdfUrl,
  signedPdfUrl,
  docusignEnvelopeId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);

  async function runAction(path: string, actionName: string) {
    setAction(actionName);
    startTransition(async () => {
      const res = await fetch(`/api/contracts/${contractId}/${path}`, { method: 'POST' });
      if (res.ok) {
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(`Action failed: ${j.error ?? res.status}`);
      }
      setAction(null);
    });
  }

  // Cancelled and executed contracts only show view links
  const isTerminal = status === 'cancelled' || status === 'executed';
  const canCancel  = !isTerminal;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Generate Draft PDF */}
      {status === 'draft' && (
        <Button onClick={() => runAction('generate', 'generate')} disabled={pending}>
          {pending && action === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate Draft PDF
        </Button>
      )}

      {/* Re-generate */}
      {status === 'ready_for_review' && (
        <Button variant="outline" onClick={() => runAction('generate', 'regenerate')} disabled={pending}>
          {pending && action === 'regenerate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Re-generate PDF
        </Button>
      )}

      {/* Approve */}
      {status === 'ready_for_review' && (
        <Button onClick={() => runAction('approve', 'approve')} disabled={pending}>
          {pending && action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Approve for Sending
        </Button>
      )}

      {/* Send via DocuSign */}
      {status === 'approved' && (
        <Button onClick={() => runAction('send', 'send')} disabled={pending}>
          {pending && action === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send via DocuSign
        </Button>
      )}

      {/* DocuSign in flight — resend notification or recall to fix email */}
      {(status === 'sent' || status === 'partially_signed') && docusignEnvelopeId && (
        <>
          <Button
            variant="outline"
            onClick={() => runAction('resend-docusign', 'resend')}
            disabled={pending}
            title="Resend DocuSign emails to signers who have not finished (same email addresses)."
          >
            {pending && action === 'resend' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Resend signing email
          </Button>
          <RecallDocusignDialog contractId={contractId} exhibitorName={exhibitorName} />
        </>
      )}

      {/* View PDFs */}
      {draftPdfUrl && (
        <Button variant="outline" asChild>
          <a href={draftPdfUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" /> View Draft PDF
          </a>
        </Button>
      )}
      {signedPdfUrl && (
        <Button variant="outline" asChild>
          <a href={signedPdfUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" /> View Signed PDF
          </a>
        </Button>
      )}

      {/* Cancel — available from any non-terminal status */}
      {canCancel && (
        <div className="ml-auto">
          <CancelContractDialog contractId={contractId} exhibitorName={exhibitorName} />
        </div>
      )}
    </div>
  );
}
