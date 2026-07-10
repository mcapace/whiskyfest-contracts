'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { emitContractActionSuccessFeedback } from '@/lib/contract-action-feedback';
import { useContractLiveOptional } from '@/components/contracts/contract-live-context';

export type ContractReviseInitialValues = {
  signerName: string;
  signerEmail: string;
  signerCcName: string | null;
  signerCcEmail: string | null;
  exhibitorLegalName: string;
  exhibitorCompanyName: string;
  brandsPoured: string | null;
  exhibitorNotes: string | null;
  revisionAmendments: string | null;
  revisionUploadPath: string | null;
  billingAddressLine1: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
  billingCountry: string | null;
};

type Props = {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: ContractReviseInitialValues;
  readOnly?: boolean;
};

export function ContractReviseWizard({ contractId, open, onOpenChange, initial, readOnly = false }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const contractLive = useContractLiveOptional();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;

  const [reason, setReason] = useState('');
  const [useUploadedPdf, setUseUploadedPdf] = useState(false);
  const [uploadPath, setUploadPath] = useState<string | null>(initial.revisionUploadPath);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [revisionAmendments, setRevisionAmendments] = useState(initial.revisionAmendments ?? '');
  const [exhibitorNotes, setExhibitorNotes] = useState(initial.exhibitorNotes ?? '');
  const [signerName, setSignerName] = useState(initial.signerName);
  const [signerEmail, setSignerEmail] = useState(initial.signerEmail);
  const [signerCcName, setSignerCcName] = useState(initial.signerCcName ?? '');
  const [signerCcEmail, setSignerCcEmail] = useState(initial.signerCcEmail ?? '');
  const [exhibitorLegalName, setExhibitorLegalName] = useState(initial.exhibitorLegalName);
  const [exhibitorCompanyName, setExhibitorCompanyName] = useState(initial.exhibitorCompanyName);
  const [brandsPoured, setBrandsPoured] = useState(initial.brandsPoured ?? '');
  const [billingAddressLine1, setBillingAddressLine1] = useState(initial.billingAddressLine1 ?? '');
  const [billingCity, setBillingCity] = useState(initial.billingCity ?? '');
  const [billingState, setBillingState] = useState(initial.billingState ?? '');
  const [billingZip, setBillingZip] = useState(initial.billingZip ?? '');
  const [billingCountry, setBillingCountry] = useState(initial.billingCountry ?? '');

  useEffect(() => {
    if (!open) return;
    setReason('');
    setUseUploadedPdf(false);
    setUploadPath(initial.revisionUploadPath);
    setUploadError(null);
    setRevisionAmendments(initial.revisionAmendments ?? '');
    setExhibitorNotes(initial.exhibitorNotes ?? '');
    setSignerName(initial.signerName);
    setSignerEmail(initial.signerEmail);
    setSignerCcName(initial.signerCcName ?? '');
    setSignerCcEmail(initial.signerCcEmail ?? '');
    setExhibitorLegalName(initial.exhibitorLegalName);
    setExhibitorCompanyName(initial.exhibitorCompanyName);
    setBrandsPoured(initial.brandsPoured ?? '');
    setBillingAddressLine1(initial.billingAddressLine1 ?? '');
    setBillingCity(initial.billingCity ?? '');
    setBillingState(initial.billingState ?? '');
    setBillingZip(initial.billingZip ?? '');
    setBillingCountry(initial.billingCountry ?? '');
  }, [open, initial]);

  async function handleUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/contracts/${contractId}/revision-upload`, { method: 'POST', body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(typeof j.error === 'string' ? j.error : 'Upload failed');
        return;
      }
      setUploadPath(typeof j.path === 'string' ? j.path : file.name);
      setUseUploadedPdf(true);
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function submitReviseAndSend() {
    if (contractLive) contractLive.setOptimisticStatus('sent');
    startTransition(async () => {
      const body: Record<string, unknown> = {
        reason: reason.trim(),
        use_uploaded_pdf: useUploadedPdf,
      };

      const setIfChanged = (key: string, value: string, initialValue: string) => {
        const trimmed = value.trim();
        if (trimmed !== initialValue.trim()) body[key] = trimmed || null;
      };

      setIfChanged('revision_amendments', revisionAmendments, initial.revisionAmendments ?? '');
      setIfChanged('exhibitor_notes', exhibitorNotes, initial.exhibitorNotes ?? '');
      setIfChanged('signer_1_name', signerName, initial.signerName);
      setIfChanged('signer_1_email', signerEmail, initial.signerEmail);
      setIfChanged('signer_cc_name', signerCcName, initial.signerCcName ?? '');
      setIfChanged('signer_cc_email', signerCcEmail, initial.signerCcEmail ?? '');
      setIfChanged('exhibitor_legal_name', exhibitorLegalName, initial.exhibitorLegalName);
      setIfChanged('exhibitor_company_name', exhibitorCompanyName, initial.exhibitorCompanyName);
      setIfChanged('brands_poured', brandsPoured, initial.brandsPoured ?? '');
      setIfChanged('billing_address_line1', billingAddressLine1, initial.billingAddressLine1 ?? '');
      setIfChanged('billing_city', billingCity, initial.billingCity ?? '');
      setIfChanged('billing_state', billingState, initial.billingState ?? '');
      setIfChanged('billing_zip', billingZip, initial.billingZip ?? '');
      setIfChanged('billing_country', billingCountry, initial.billingCountry ?? '');

      const res = await fetch(`/api/contracts/${contractId}/revise-and-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        contractLive?.setOptimisticStatus(null);
        emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
        onOpenChange(false);
        router.refresh();
        queueMicrotask(() => router.refresh());
      } else {
        contractLive?.setOptimisticStatus(null);
        const j = await res.json().catch(() => ({}));
        alert(`Revise and send failed: ${j.error ?? res.status}`);
      }
    });
  }

  const canSubmit =
    reason.trim().length >= 10 &&
    signerName.trim().length > 0 &&
    signerEmail.trim().length > 0 &&
    (!useUploadedPdf || Boolean(uploadPath));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Revise and send</DialogTitle>
          <DialogDescription>
            Void the current DocuSign envelope, apply client revisions, and send a new customized contract. Upload a
            redlined PDF or enter the changes below — the master template will be regenerated with your amendments unless
            you choose to send the uploaded document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <div className="space-y-2">
            <Label htmlFor="revise-reason">Reason for revision (required)</Label>
            <Textarea
              id="revise-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Client requested billing address change and added custom payment terms"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-parchment-200 bg-parchment-50/60 p-4">
            <p className="font-medium">Client redlined PDF (optional)</p>
            <p className="text-muted-foreground text-xs">
              Upload the client&apos;s marked-up contract for reference, or check &quot;Send uploaded document&quot; to
              email that PDF via DocuSign instead of regenerating from the master template.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Choose PDF'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  disabled={busy || uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {uploadPath ? (
                <span className="text-xs text-emerald-800">Uploaded — ready to send</span>
              ) : (
                <span className="text-xs text-muted-foreground">No file uploaded yet</span>
              )}
            </div>
            {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={useUploadedPdf}
                onChange={(e) => setUseUploadedPdf(e.target.checked)}
                disabled={!uploadPath}
              />
              <span>
                Send uploaded document via DocuSign
                {!uploadPath ? (
                  <span className="block text-xs text-muted-foreground">Upload a PDF first to enable this option.</span>
                ) : null}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            <p className="font-medium">Contract adjustments</p>
            <p className="text-muted-foreground text-xs">
              Leave fields unchanged to keep current values. Amendments appear in the contract via{' '}
              <code className="rounded bg-muted px-1">{'{{revision_amendments}}'}</code> on the master template.
            </p>

            <div className="space-y-2">
              <Label htmlFor="revise-amendments">Revision amendments / custom terms</Label>
              <Textarea
                id="revise-amendments"
                value={revisionAmendments}
                onChange={(e) => setRevisionAmendments(e.target.value)}
                placeholder="Paste or summarize client-requested term changes"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="revise-exhibitor-notes">Exhibitor notes</Label>
              <Textarea
                id="revise-exhibitor-notes"
                value={exhibitorNotes}
                onChange={(e) => setExhibitorNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="revise-signer-name">Signer name</Label>
                <Input id="revise-signer-name" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-signer-email">Signer email</Label>
                <Input
                  id="revise-signer-email"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-cc-name">CC name (optional)</Label>
                <Input id="revise-cc-name" value={signerCcName} onChange={(e) => setSignerCcName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-cc-email">CC email (optional)</Label>
                <Input
                  id="revise-cc-email"
                  type="email"
                  value={signerCcEmail}
                  onChange={(e) => setSignerCcEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-legal-name">Legal name</Label>
                <Input
                  id="revise-legal-name"
                  value={exhibitorLegalName}
                  onChange={(e) => setExhibitorLegalName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-company-name">Company name</Label>
                <Input
                  id="revise-company-name"
                  value={exhibitorCompanyName}
                  onChange={(e) => setExhibitorCompanyName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revise-brands">Brands poured</Label>
              <Input id="revise-brands" value={brandsPoured} onChange={(e) => setBrandsPoured(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="revise-billing-line1">Billing address</Label>
              <Input
                id="revise-billing-line1"
                value={billingAddressLine1}
                onChange={(e) => setBillingAddressLine1(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="revise-billing-city">City</Label>
                <Input id="revise-billing-city" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-billing-state">State</Label>
                <Input id="revise-billing-state" value={billingState} onChange={(e) => setBillingState(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-billing-zip">ZIP</Label>
                <Input id="revise-billing-zip" value={billingZip} onChange={(e) => setBillingZip(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revise-billing-country">Country</Label>
                <Input
                  id="revise-billing-country"
                  value={billingCountry}
                  onChange={(e) => setBillingCountry(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submitReviseAndSend()} disabled={busy || !canSubmit}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Void, revise, and send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
