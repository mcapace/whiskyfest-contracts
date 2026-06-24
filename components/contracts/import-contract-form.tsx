'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { emitContractActionSuccessFeedback } from '@/lib/contract-action-feedback';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SalesRepSelect } from '@/components/contracts/sales-rep-select';
import { suggestBrandCategory, type BrandCategory } from '@/lib/brand-category';
import { BoothBrandInput, type BoothBrandValue } from '@/components/contracts/booth-brand-input';
import {
  INTERNAL_CONTRACT_NOTES_HINT,
  INTERNAL_CONTRACT_NOTES_LABEL,
  INTERNAL_CONTRACT_NOTES_PLACEHOLDER,
  SPONSOR_CONTRACT_NOTES_HINT,
  SPONSOR_CONTRACT_NOTES_LABEL,
  SPONSOR_CONTRACT_NOTES_PLACEHOLDER,
} from '@/lib/contract-notes-copy';
import { dealKindMeta, type ContractDealKind } from '@/lib/contract-deal-kind';
import { formatLongDate } from '@/lib/utils';
import type { Event } from '@/types/db';

type ImportDealKind = Extract<ContractDealKind, 'booth' | 'sponsorship_only'>;
type SponsorshipLineDraft = { key: string; description: string; amountInput: string };

function parseDollarsToNumber(raw: string): number | null {
  const t = raw.replace(/[$,]/g, '').trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function boothRowsForCount(count: number, prev: BoothBrandValue[]): BoothBrandValue[] {
  const next = [...prev];
  while (next.length < count) next.push({ brand_name: '', brand_category: 'Other', expressions: [] });
  return next.slice(0, count);
}

export function ImportContractForm({
  events,
  currentUserEmail,
  isAdmin,
  isEventsTeam = false,
}: {
  events: Event[];
  currentUserEmail: string | null;
  isAdmin: boolean;
  isEventsTeam?: boolean;
}) {
  const canPickAnySalesRep = isAdmin || isEventsTeam;
  const router = useRouter();
  const { data: session } = useSession();
  const errorRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (err) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [err]);

  const defaultEvent = events[0];
  const [eventId, setEventId] = useState(defaultEvent?.id ?? '');

  const resolvedEventId =
    eventId && events.some((ev) => ev.id === eventId) ? eventId : (events[0]?.id ?? undefined);

  useEffect(() => {
    if (!eventId && events[0]?.id) setEventId(events[0].id);
  }, [eventId, events]);
  const [exhibitorCompany, setExhibitorCompany] = useState('');
  const [exhibitorLegal, setExhibitorLegal] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  const [salesRepId, setSalesRepId] = useState('');
  const [boothCountInput, setBoothCountInput] = useState('1');
  const [boothRateInput, setBoothRateInput] = useState('');
  const [grandTotalInput, setGrandTotalInput] = useState('');
  const [exhibitorNotes, setExhibitorNotes] = useState('');
  const [notes, setNotes] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingAddressNotes, setBillingAddressNotes] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [importKind, setImportKind] = useState<ImportDealKind>('booth');
  const [sponsorBrand, setSponsorBrand] = useState('');
  const [sponsorshipLines, setSponsorshipLines] = useState<SponsorshipLineDraft[]>([
    { key: 'line-1', description: '', amountInput: '' },
  ]);
  const [boothBrandRows, setBoothBrandRows] = useState<BoothBrandValue[]>([
    { brand_name: '', brand_category: 'Other', expressions: [] },
  ]);

  const boothCount = useMemo(() => {
    const n = parseInt(boothCountInput.trim(), 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  }, [boothCountInput]);

  useEffect(() => {
    setBoothBrandRows((prev) => boothRowsForCount(boothCount, prev));
  }, [boothCount]);

  function boothTailHasData(rows: BoothBrandValue[], fromIndex: number): boolean {
    return rows.slice(fromIndex).some(
      (r) => r.brand_name.trim().length > 0 || (r.expressions?.length ?? 0) > 0,
    );
  }

  function normalizeBoothCountOnBlur() {
    const n = Math.max(1, parseInt(boothCountInput.trim(), 10) || 1);
    if (n < boothBrandRows.length && boothTailHasData(boothBrandRows, n)) {
      const label =
        boothBrandRows.length === n + 1 ? `Booth ${n + 1}` : `Booth ${n + 1}–${boothBrandRows.length}`;
      if (!window.confirm(`This will remove ${label} brand information. Continue?`)) {
        setBoothCountInput(String(boothBrandRows.length));
        return;
      }
      setBoothBrandRows((rows) => rows.slice(0, n));
    }
    setBoothCountInput(String(n));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!resolvedEventId) {
      setErr('Select an event.');
      return;
    }
    if (!exhibitorCompany.trim() || !exhibitorLegal.trim()) {
      setErr('Company name and legal name are required.');
      return;
    }
    if (!signerName.trim() || !signerEmail.trim()) {
      setErr('Signer name and email are required.');
      return;
    }
    if (!salesRepId) {
      setErr('Sales rep is required.');
      return;
    }
    const sponsorshipOnly = importKind === 'sponsorship_only';

    if (!sponsorshipOnly && (!boothRateInput.trim() || !grandTotalInput.trim())) {
      setErr('Booth rate and grand total are required.');
      return;
    }

    if (sponsorshipOnly) {
      if (!sponsorBrand.trim()) {
        setErr('Sponsor / brand name is required.');
        return;
      }
      const parsedLines = sponsorshipLines
        .map((row) => {
          const amount = parseDollarsToNumber(row.amountInput);
          return {
            description: row.description.trim(),
            amount,
          };
        })
        .filter((row) => row.description.length > 0 || row.amount !== null);
      if (parsedLines.length === 0 || parsedLines.some((row) => !row.description || row.amount === null)) {
        setErr('Add at least one sponsorship line item with description and amount.');
        return;
      }
    }
    if (!signedAt) {
      setErr('Original signature date is required.');
      return;
    }
    if (!pdfFile || pdfFile.size === 0) {
      setErr('Upload the signed PDF.');
      return;
    }
    if (pdfFile.type && pdfFile.type !== 'application/pdf') {
      setErr('File must be a PDF.');
      return;
    }
    if (pdfFile.size > 10 * 1024 * 1024) {
      setErr('PDF must be under 10 MB.');
      return;
    }

    if (!sponsorshipOnly) {
      for (let i = 0; i < boothCount; i++) {
        if (!boothBrandRows[i]?.brand_name?.trim()) {
          setErr(`Brand name is required for booth ${i + 1}.`);
          return;
        }
      }
    }

    const booth_brands = sponsorshipOnly
      ? []
      : Array.from({ length: boothCount }, (_, i) => {
      const row = boothBrandRows[i] ?? { brand_name: '', brand_category: 'Other' as BrandCategory, expressions: [] };
      return {
        booth_index: i + 1,
        brand_name: row.brand_name.trim(),
        brand_category: row.brand_category,
        expressions: (row.expressions ?? []).filter(Boolean),
      };
    });

    const sponsorshipLinePayload = sponsorshipOnly
      ? sponsorshipLines
          .map((row) => ({
            description: row.description.trim(),
            amount_dollars: row.amountInput.trim(),
          }))
          .filter((row) => row.description && row.amount_dollars)
      : [];

    const sponsorshipGrandTotal = sponsorshipOnly
      ? sponsorshipLinePayload.reduce((sum, row) => sum + (parseDollarsToNumber(row.amount_dollars) ?? 0), 0)
      : 0;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set('order_type', sponsorshipOnly ? 'sponsorship_only' : 'booth');
      fd.set('event_id', resolvedEventId);
      fd.set('exhibitor_company_name', exhibitorCompany.trim());
      fd.set('exhibitor_legal_name', exhibitorLegal.trim());
      fd.set('signer_1_name', signerName.trim());
      fd.set('signer_1_email', signerEmail.trim());
      fd.set('signer_1_title', signerTitle.trim());
      fd.set('exhibitor_telephone', phone.trim());
      fd.set('exhibitor_address_line1', addr1.trim());
      fd.set('exhibitor_address_line2', addr2.trim());
      fd.set('exhibitor_city', city.trim());
      fd.set('exhibitor_state', state.trim());
      fd.set('exhibitor_zip', zip.trim());
      fd.set('exhibitor_country', country.trim());
      fd.set('sales_rep_id', salesRepId);
      fd.set('booth_count', sponsorshipOnly ? '0' : String(boothCount));
      fd.set('booth_rate_dollars', sponsorshipOnly ? '0' : boothRateInput.trim());
      fd.set(
        'grand_total_dollars',
        sponsorshipOnly ? String(sponsorshipGrandTotal) : grandTotalInput.trim(),
      );
      if (sponsorshipOnly) {
        fd.set('sponsor_brand', sponsorBrand.trim());
        fd.set('line_items_json', JSON.stringify(sponsorshipLinePayload));
      }
      fd.set('originally_signed_at', signedAt);
      fd.set('exhibitor_notes', exhibitorNotes.trim());
      fd.set('notes', notes.trim());
      fd.set('billing_contact_name', billingName.trim());
      fd.set('billing_contact_email', billingEmail.trim());
      fd.set('billing_address_notes', billingAddressNotes.trim());
      fd.set('booth_brands_json', JSON.stringify(booth_brands));
      fd.set('signed_pdf', pdfFile);

      const res = await fetch('/api/contracts/import', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === 'string' ? j.error : 'Import failed.');
        return;
      }
      emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
      const id = (j.id ?? j.contractId) as string | undefined;
      if (id) {
        // All Contracts + success banner — avoids auto-opening contract detail (crash on some PCs).
        router.replace(`/contracts?imported=${encodeURIComponent(id)}`);
        return;
      }
      setErr('Import saved but no contract id was returned. Open All Contracts to find the new record.');
    } catch {
      setErr('Import failed — network error. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/contracts"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All contracts
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Import contract</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a sponsor agreement that was signed before this platform launched (paper, email PDF, or legacy
          DocuSign). {canPickAnySalesRep ? 'Assign the deal to the correct sales rep.' : 'The contract will be assigned to your rep account.'}{' '}
          Events or admin can release it to accounting when ready.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.defaultPrevented) return;
          const t = e.target as HTMLElement;
          if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON') return;
          if (t.tagName === 'INPUT') {
            const inp = t as HTMLInputElement;
            if (inp.type === 'submit' || inp.type === 'file') return;
            e.preventDefault();
          }
        }}
      >
        {err ? (
          <div
            ref={errorRef}
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          >
            {err}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Event</CardTitle>
            <CardDescription>WhiskyFest this agreement belongs to.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="import-event">Event</Label>
            {events.length === 0 ? (
              <p className="mt-1.5 text-sm text-destructive">No active events — contact an admin.</p>
            ) : (
              <Select
                value={resolvedEventId}
                onValueChange={setEventId}
                required
              >
                <SelectTrigger id="import-event" className="mt-1.5">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.name} — {formatLongDate(ev.event_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contract details</CardTitle>
            <CardDescription>Sponsor and signer as they appear on the agreement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Sponsor company name" htmlFor="icc">
              <Input
                id="icc"
                value={exhibitorCompany}
                onChange={(e) => setExhibitorCompany(e.target.value)}
                required
                autoComplete="organization"
              />
            </Field>
            <Field label="Legal name" htmlFor="icl">
              <Input
                id="icl"
                value={exhibitorLegal}
                onChange={(e) => setExhibitorLegal(e.target.value)}
                required
                autoComplete="off"
              />
            </Field>
            <Field label="Signer name" htmlFor="isn">
              <Input id="isn" value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
            </Field>
            <Field label="Signer email" htmlFor="ise">
              <Input
                id="ise"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Signer title" htmlFor="ist">
              <Input id="ist" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="iph">
              <Input id="iph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Mailing address on file (optional).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Mailing address line 1" htmlFor="ia1">
              <Input id="ia1" value={addr1} onChange={(e) => setAddr1(e.target.value)} autoComplete="street-address" />
            </Field>
            <Field label="Line 2 (optional)" htmlFor="ia2">
              <Input id="ia2" value={addr2} onChange={(e) => setAddr2(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" htmlFor="icity">
                <Input id="icity" value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="State" htmlFor="istate">
                <Input id="istate" value={state} onChange={(e) => setState(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Zip" htmlFor="izip">
                <Input id="izip" value={zip} onChange={(e) => setZip(e.target.value)} />
              </Field>
              <Field label="Country" htmlFor="ict">
                <Input id="ict" value={country} onChange={(e) => setCountry(e.target.value)} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales rep & financials</CardTitle>
            <CardDescription>Choose booth import or sponsorship-only (no booth on the agreement).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['booth', 'sponsorship_only'] as const).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant={importKind === kind ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setImportKind(kind)}
                >
                  {dealKindMeta(kind).title}
                </Button>
              ))}
            </div>
            <SalesRepSelect
              currentUserEmail={currentUserEmail}
              value={salesRepId}
              onChange={setSalesRepId}
              isAdmin={canPickAnySalesRep}
              required
            />
            {importKind === 'booth' ? (
              <>
                <Field label="Booth count" htmlFor="ibc">
                  <Input
                    id="ibc"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={boothCountInput}
                    onChange={(e) => setBoothCountInput(e.target.value)}
                    onBlur={normalizeBoothCountOnBlur}
                    required
                  />
                </Field>
                <Field label="Rate per booth ($)" hint="Numbers only; decimals allowed.">
                  <Input
                    id="ibr"
                    inputMode="decimal"
                    value={boothRateInput}
                    onChange={(e) => setBoothRateInput(e.target.value)}
                    required
                    aria-describedby="ibr-hint"
                  />
                  <p id="ibr-hint" className="mt-1 text-xs text-muted-foreground">
                    Example: 15000 or 15000.00
                  </p>
                </Field>
                <Field label="Grand total ($)" hint="Must be at least booth count × rate.">
                  <Input
                    id="igt"
                    inputMode="decimal"
                    value={grandTotalInput}
                    onChange={(e) => setGrandTotalInput(e.target.value)}
                    required
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Sponsor / brand on agreement" htmlFor="isponsor-brand">
                  <Input
                    id="isponsor-brand"
                    value={sponsorBrand}
                    onChange={(e) => setSponsorBrand(e.target.value)}
                    required
                  />
                </Field>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Sponsorship line items</p>
                  {sponsorshipLines.map((row, idx) => (
                    <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_140px_auto] sm:items-end">
                      <Field label={idx === 0 ? 'Description' : ''} htmlFor={`sli-desc-${row.key}`}>
                        <Input
                          id={`sli-desc-${row.key}`}
                          value={row.description}
                          onChange={(e) =>
                            setSponsorshipLines((list) =>
                              list.map((r) => (r.key === row.key ? { ...r, description: e.target.value } : r)),
                            )
                          }
                        />
                      </Field>
                      <Field label={idx === 0 ? 'Amount ($)' : ''} htmlFor={`sli-amt-${row.key}`}>
                        <Input
                          id={`sli-amt-${row.key}`}
                          inputMode="decimal"
                          value={row.amountInput}
                          onChange={(e) =>
                            setSponsorshipLines((list) =>
                              list.map((r) => (r.key === row.key ? { ...r, amountInput: e.target.value } : r)),
                            )
                          }
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={sponsorshipLines.length <= 1}
                        onClick={() => setSponsorshipLines((list) => list.filter((r) => r.key !== row.key))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSponsorshipLines((list) => [
                        ...list,
                        { key: `line-${sponsorshipLines.length + 1}`, description: '', amountInput: '' },
                      ])
                    }
                  >
                    Add line item
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-whisky-200/60">
          <CardHeader>
            <CardTitle>Contract notes</CardTitle>
            <CardDescription>
              The signed PDF you upload is the legal document. Optionally record program terms here so the team
              can see them in the app (same field used on new contracts).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-whisky-300/50 bg-whisky-50/40 p-4">
              <Field label={SPONSOR_CONTRACT_NOTES_LABEL} hint={SPONSOR_CONTRACT_NOTES_HINT} htmlFor="iexhibitor-notes">
                <Textarea
                  id="iexhibitor-notes"
                  value={exhibitorNotes}
                  onChange={(e) => setExhibitorNotes(e.target.value)}
                  placeholder={SPONSOR_CONTRACT_NOTES_PLACEHOLDER}
                  rows={4}
                  className="bg-background"
                />
              </Field>
            </div>
            <Field label={INTERNAL_CONTRACT_NOTES_LABEL} hint={INTERNAL_CONTRACT_NOTES_HINT} htmlFor="inotes">
              <Textarea
                id="inotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={INTERNAL_CONTRACT_NOTES_PLACEHOLDER}
                rows={3}
              />
            </Field>
          </CardContent>
        </Card>

        {importKind === 'booth' ? (
          <Card>
            <CardHeader>
              <CardTitle>Brands & expressions</CardTitle>
              <CardDescription>One brand per booth. List specific expressions you pour (optional).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: boothCount }).map((_, idx) => (
                <BoothBrandInput
                  key={idx}
                  boothNumber={idx + 1}
                  value={
                    boothBrandRows[idx] ?? {
                      brand_name: '',
                      brand_category: 'Other',
                      expressions: [],
                    }
                  }
                  exhibitorCompany={exhibitorCompany}
                  onChange={(next) =>
                    setBoothBrandRows((rows) => {
                      const copy = [...rows];
                      copy[idx] = next;
                      return copy;
                    })
                  }
                />
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Signed PDF</CardTitle>
            <CardDescription>Upload the executed agreement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="signed_pdf">Signed contract PDF</Label>
              <input
                id="signed_pdf"
                name="signed_pdf"
                type="file"
                accept="application/pdf"
                required
                className="block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/80"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                Upload the PDF of the actual signed contract (from email, scan, or DocuSign export).
              </p>
            </div>
            <Field label="Date originally signed" htmlFor="isigned">
              <Input
                id="isigned"
                type="date"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
                required
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing (optional)</CardTitle>
            <CardDescription>For accounting handoff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Billing contact name" htmlFor="ibn">
              <Input id="ibn" value={billingName} onChange={(e) => setBillingName(e.target.value)} />
            </Field>
            <Field label="Billing contact email" htmlFor="ibe">
              <Input id="ibe" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />
            </Field>
            <Field label="Billing address (full)" htmlFor="iba">
              <Textarea id="iba" value={billingAddressNotes} onChange={(e) => setBillingAddressNotes(e.target.value)} rows={3} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Import contract
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/contracts">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
