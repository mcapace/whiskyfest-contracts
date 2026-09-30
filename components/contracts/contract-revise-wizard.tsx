'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
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
import { revisionPlanToDisplayLines, type ContractRevisionPlan } from '@/lib/contract-revision-plan';
import { useContractLiveOptional } from '@/components/contracts/contract-live-context';

export type ContractReviseInitialValues = {
  signerName: string;
  signerEmail: string;
  signerCcName: string | null;
  signerCcEmail: string | null;
  signer2Name?: string | null;
  signer2Title?: string | null;
  signer2Email?: string | null;
  /** WhiskyFest / Big Smoke templates carry a second-signature block; NYWE does not. */
  allowSecondSigner?: boolean;
  /** Inline edits already on the contract (applied on every render). */
  revisionPlan?: ContractRevisionPlan | null;
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
  /**
   * `revise` (default): contract is out for signature — void, apply edits, resend via DocuSign.
   * `apply`: contract not yet sent — apply edits, regenerate the clean draft, no DocuSign activity.
   */
  mode?: 'revise' | 'apply';
};

const AMENDMENT_IMPORT_ACCEPT = '.pdf,.docx,.txt,.md,.eml,.rtf,application/pdf,text/plain,message/rfc822';

export function ContractReviseWizard({
  contractId,
  open,
  onOpenChange,
  initial,
  readOnly = false,
  mode = 'revise',
}: Props) {
  const applyMode = mode === 'apply';
  const router = useRouter();
  const { data: session } = useSession();
  const contractLive = useContractLiveOptional();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;

  const [reason, setReason] = useState('');
  const [changeRequest, setChangeRequest] = useState('');
  const [revisionPlan, setRevisionPlan] = useState<ContractRevisionPlan | null>(null);
  const [planPreviewLines, setPlanPreviewLines] = useState<string[]>([]);
  const [planError, setPlanError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [useUploadedPdf, setUseUploadedPdf] = useState(false);
  const [uploadPath, setUploadPath] = useState<string | null>(initial.revisionUploadPath);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [revisionAmendments, setRevisionAmendments] = useState(initial.revisionAmendments ?? '');
  const [exhibitorNotes, setExhibitorNotes] = useState(initial.exhibitorNotes ?? '');
  const [replaceExistingEdits, setReplaceExistingEdits] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewedOnce, setPreviewedOnce] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string | null>(null);
  const existingEditLines = useMemo(
    () => (initial.revisionPlan ? revisionPlanToDisplayLines(initial.revisionPlan) : []),
    [initial.revisionPlan],
  );
  const [signerName, setSignerName] = useState(initial.signerName);
  const [signerEmail, setSignerEmail] = useState(initial.signerEmail);
  const [signerCcName, setSignerCcName] = useState(initial.signerCcName ?? '');
  const [signerCcEmail, setSignerCcEmail] = useState(initial.signerCcEmail ?? '');
  const [signer2Name, setSigner2Name] = useState(initial.signer2Name ?? '');
  const [signer2Title, setSigner2Title] = useState(initial.signer2Title ?? '');
  const [signer2Email, setSigner2Email] = useState(initial.signer2Email ?? '');
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
    setChangeRequest('');
    setRevisionPlan(null);
    setPlanPreviewLines([]);
    setPlanError(null);
    setUseUploadedPdf(false);
    setUploadPath(initial.revisionUploadPath);
    setUploadError(null);
    setRevisionAmendments(initial.revisionAmendments ?? '');
    setExhibitorNotes(initial.exhibitorNotes ?? '');
    setReplaceExistingEdits(false);
    setImportError(null);
    setImportedFileName(null);
    setPreviewedOnce(false);
    setPreviewError(null);
    setPreviewWarnings(null);
    setSignerName(initial.signerName);
    setSignerEmail(initial.signerEmail);
    setSignerCcName(initial.signerCcName ?? '');
    setSignerCcEmail(initial.signerCcEmail ?? '');
    setSigner2Name(initial.signer2Name ?? '');
    setSigner2Title(initial.signer2Title ?? '');
    setSigner2Email(initial.signer2Email ?? '');
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

  async function importAmendmentsFile(file: File) {
    setImportError(null);
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/contracts/${contractId}/amendments-import`, { method: 'POST', body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || typeof j.text !== 'string') {
        setImportError(typeof j.error === 'string' ? j.error : 'Could not read that file');
        return;
      }
      const incoming = String(j.text).trim();
      setChangeRequest((prev) => (prev.trim() ? `${prev.trim()}\n\n${incoming}` : incoming));
      setImportedFileName(file.name);
      setRevisionPlan(null);
      setPlanPreviewLines([]);
      setPlanError(null);
    } catch {
      setImportError('Could not read that file');
    } finally {
      setImporting(false);
    }
  }

  async function analyzeChanges() {
    setPlanError(null);
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/revision-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ change_request: changeRequest.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPlanError(typeof j.error === 'string' ? j.error : 'Analysis failed');
        setRevisionPlan(null);
        setPlanPreviewLines([]);
        return;
      }
      setRevisionPlan(j.plan as ContractRevisionPlan);
      setPlanPreviewLines(Array.isArray(j.preview_lines) ? j.preview_lines : []);
      const plan = j.plan as ContractRevisionPlan | undefined;
      if (plan?.field_updates?.exhibitor_legal_name) {
        setExhibitorLegalName(plan.field_updates.exhibitor_legal_name);
      }
      if (plan?.field_updates?.exhibitor_company_name) {
        setExhibitorCompanyName(plan.field_updates.exhibitor_company_name);
      }
      if (plan?.field_updates?.signer_1_name) setSignerName(plan.field_updates.signer_1_name);
      if (plan?.field_updates?.signer_1_email) setSignerEmail(plan.field_updates.signer_1_email);
    } catch {
      setPlanError('Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  function buildRequestBody(): Record<string, unknown> {
      const body: Record<string, unknown> = {
        reason: reason.trim(),
        use_uploaded_pdf: useUploadedPdf,
        replace_existing_edits: replaceExistingEdits,
      };

      if (changeRequest.trim().length >= 10) body.change_request = changeRequest.trim();
      if (revisionPlan) body.revision_plan = revisionPlan;

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
      if (initial.allowSecondSigner) {
        setIfChanged('signer_2_name', signer2Name, initial.signer2Name ?? '');
        setIfChanged('signer_2_title', signer2Title, initial.signer2Title ?? '');
        setIfChanged('signer_2_email', signer2Email, initial.signer2Email ?? '');
      }
      setIfChanged('exhibitor_legal_name', exhibitorLegalName, initial.exhibitorLegalName);
      setIfChanged('exhibitor_company_name', exhibitorCompanyName, initial.exhibitorCompanyName);
      setIfChanged('brands_poured', brandsPoured, initial.brandsPoured ?? '');
      setIfChanged('billing_address_line1', billingAddressLine1, initial.billingAddressLine1 ?? '');
      setIfChanged('billing_city', billingCity, initial.billingCity ?? '');
      setIfChanged('billing_state', billingState, initial.billingState ?? '');
      setIfChanged('billing_zip', billingZip, initial.billingZip ?? '');
      setIfChanged('billing_country', billingCountry, initial.billingCountry ?? '');
      return body;
  }

  async function previewRevision() {
    setPreviewError(null);
    setPreviewWarnings(null);
    setPreviewing(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/revision-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreviewError(typeof j.error === 'string' ? j.error : 'Preview failed');
        return;
      }
      if (j.plan && !revisionPlan) {
        setRevisionPlan(j.plan as ContractRevisionPlan);
        setPlanPreviewLines(Array.isArray(j.preview_lines) ? j.preview_lines : []);
      }
      if (typeof j.warnings === 'string' && j.warnings) setPreviewWarnings(j.warnings);
      const bytes = Uint8Array.from(atob(String(j.pdf_base64 ?? '')), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setPreviewedOnce(true);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setPreviewError('Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  function submitReviseAndSend() {
    if (contractLive && !applyMode) contractLive.setOptimisticStatus('sent');
    startTransition(async () => {
      const body = buildRequestBody();
      const endpoint = applyMode ? 'apply-revision' : 'revise-and-send';

      const res = await fetch(`/api/contracts/${contractId}/${endpoint}`, {
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
        alert(`${applyMode ? 'Applying amendments' : 'Revise and send'} failed: ${j.error ?? res.status}`);
      }
    });
  }

  const hasChanges =
    changeRequest.trim().length >= 10 ||
    Boolean(revisionPlan) ||
    revisionAmendments.trim().length > 0 ||
    (replaceExistingEdits && existingEditLines.length > 0);
  const canSubmit =
    (applyMode || reason.trim().length >= 10) &&
    signerName.trim().length > 0 &&
    signerEmail.trim().length > 0 &&
    (useUploadedPdf && !applyMode ? Boolean(uploadPath) : hasChanges);

  const busyAll = busy || analyzing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{applyMode ? 'Apply client amendments' : 'Revise and send'}</DialogTitle>
          <DialogDescription>
            {applyMode
              ? 'Import or paste the amendments the client sent. The system turns them into inline edits to the contract itself — clauses replaced, removed or added in place, names and terms swapped — plus numbered Additional Terms only for anything that cannot live inline. Preview the clean draft, then save it to the contract; send it whenever you are ready.'
              : 'Describe what the client wants changed. The system turns the request into inline edits to the contract itself — clauses replaced, removed or added in place, names and terms swapped — plus numbered Additional Terms only for anything that cannot live inline. Preview the PDF, then void and resend via DocuSign.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {existingEditLines.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-amber-200/80 bg-amber-50/50 p-4">
              <p className="font-medium">Inline edits already on this contract</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-foreground/90">
                {existingEditLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={replaceExistingEdits}
                  onChange={(e) => setReplaceExistingEdits(e.target.checked)}
                />
                <span>Start over: drop these edits and apply only what is entered below.</span>
              </label>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="revise-reason">{applyMode ? 'Note for the audit trail (optional)' : 'Reason for revision (required)'}</Label>
            <Textarea
              id="revise-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Suntory redlines — party name, Net 60, remove Med Exp"
              rows={2}
              maxLength={1000}
            />
          </div>

          <div className="space-y-3 rounded-lg border border-blue-200/80 bg-blue-50/50 p-4">
            <p className="font-medium">Client requested changes</p>
            <p className="text-muted-foreground text-xs">
              Paste the client&apos;s email or bullet list, or import the file they sent. Click{' '}
              <strong>Analyze changes</strong> to see how the contract will be edited.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/50">
                <Upload className="h-4 w-4" />
                {importing ? 'Reading…' : 'Import from file (PDF, Word, email, text)'}
                <input
                  type="file"
                  accept={AMENDMENT_IMPORT_ACCEPT}
                  className="sr-only"
                  disabled={busy || importing || useUploadedPdf}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void importAmendmentsFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {importedFileName ? (
                <span className="text-xs text-emerald-800">Imported {importedFileName} — review the text below</span>
              ) : null}
            </div>
            {importError ? <p className="text-xs text-destructive">{importError}</p> : null}
            <Textarea
              id="revise-change-request"
              value={changeRequest}
              onChange={(e) => {
                setChangeRequest(e.target.value);
                setRevisionPlan(null);
                setPlanPreviewLines([]);
                setPlanError(null);
              }}
              placeholder={`Replace references to Suntory Global Spirits with "Jim Beam Brands Co."\nUpdate payment terms to Net 60\nDelete the medical expense insurance coverage ("Med Exp")`}
              rows={5}
              disabled={useUploadedPdf}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busyAll || useUploadedPdf || changeRequest.trim().length < 10}
                onClick={() => void analyzeChanges()}
              >
                {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Analyze changes
              </Button>
              {revisionPlan ? (
                <span className="text-xs text-emerald-800">Plan ready — review below before sending</span>
              ) : null}
            </div>
            {planError ? <p className="text-xs text-destructive">{planError}</p> : null}
            {planPreviewLines.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-foreground/90">
                {planPreviewLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {applyMode ? null : (
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
          )}

          <div className="space-y-4">
            <p className="font-medium">Manual overrides (optional)</p>
            <p className="text-muted-foreground text-xs">
              These override analyzed values. Use only if you need to tweak something the plan missed.
            </p>

            <div className="space-y-2">
              <Label htmlFor="revise-amendments">Additional terms (one per line)</Label>
              <Textarea
                id="revise-amendments"
                value={revisionAmendments}
                onChange={(e) => setRevisionAmendments(e.target.value)}
                placeholder={`Each line becomes a numbered item under "Additional Terms and Amendments". Leave empty and the section is omitted from the PDF.`}
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
              {initial.allowSecondSigner ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="revise-signer2-name">Second signer name (optional)</Label>
                    <Input id="revise-signer2-name" value={signer2Name} onChange={(e) => setSigner2Name(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revise-signer2-email">Second signer email (optional)</Label>
                    <Input
                      id="revise-signer2-email"
                      type="email"
                      value={signer2Email}
                      onChange={(e) => setSigner2Email(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revise-signer2-title">Second signer title (optional)</Label>
                    <Input id="revise-signer2-title" value={signer2Title} onChange={(e) => setSigner2Title(e.target.value)} />
                  </div>
                </>
              ) : null}
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

        {previewError ? <p className="text-xs text-destructive">{previewError}</p> : null}
        {previewWarnings ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {previewWarnings} Sending is blocked until every inline edit matches.
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void previewRevision()}
            disabled={busyAll || previewing || useUploadedPdf}
          >
            {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Preview revised contract
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busyAll}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitReviseAndSend()}
              disabled={busyAll || !canSubmit || Boolean(previewWarnings)}
              title={!useUploadedPdf && !previewedOnce ? 'Tip: preview the PDF first' : undefined}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {applyMode ? 'Apply to contract' : 'Void, revise, and send'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
