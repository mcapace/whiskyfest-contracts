'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
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
import { BoothBrandInput, type BoothBrandValue } from '@/components/contracts/booth-brand-input';
import { formatLongDate } from '@/lib/utils';
import type { Event } from '@/types/db';

function boothRowsForCount(count: number, prev: BoothBrandValue[]): BoothBrandValue[] {
  const next = [...prev];
  while (next.length < count) next.push({ brand_name: '', expressions: [] });
  return next.slice(0, count);
}

export function ImportContractForm({
  events,
  currentUserEmail,
  isAdmin,
}: {
  events: Event[];
  currentUserEmail: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const defaultEvent = events[0];
  const [eventId, setEventId] = useState(defaultEvent?.id ?? '');
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
  const [notes, setNotes] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingAddressNotes, setBillingAddressNotes] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [boothBrandRows, setBoothBrandRows] = useState<BoothBrandValue[]>([{ brand_name: '', expressions: [] }]);

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

    if (!eventId) {
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
    if (!boothRateInput.trim() || !grandTotalInput.trim()) {
      setErr('Booth rate and grand total are required.');
      return;
    }
    if (!signedAt) {
      setErr('Original signature date is required.');
      return;
    }
    if (!pdfFile || pdfFile.size === 0) {
      setErr('Upload the signed PDF.');
      return;
    }

    for (let i = 0; i < boothCount; i++) {
      if (!boothBrandRows[i]?.brand_name?.trim()) {
        setErr(`Brand name is required for booth ${i + 1}.`);
        return;
      }
    }

    const booth_brands = Array.from({ length: boothCount }, (_, i) => ({
      booth_index: i + 1,
      brand_name: boothBrandRows[i]!.brand_name.trim(),
      expressions: (boothBrandRows[i]!.expressions ?? []).filter(Boolean),
    }));

    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
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
      fd.set('booth_count', String(boothCount));
      fd.set('booth_rate_dollars', boothRateInput.trim());
      fd.set('grand_total_dollars', grandTotalInput.trim());
      fd.set('originally_signed_at', signedAt);
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
      const id = j.id as string | undefined;
      if (id) router.push(`/contracts/${id}`);
      else router.push('/contracts');
      router.refresh();
    });
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
          Enter a sponsor agreement that was signed outside this app (paper or legacy DocuSign). Accounting release
          works the same as fully signed contracts.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
            <Select value={eventId} onValueChange={setEventId}>
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
          </CardHeader>
          <CardContent className="space-y-4">
            <SalesRepSelect
              currentUserEmail={currentUserEmail}
              value={salesRepId}
              onChange={setSalesRepId}
              isAdmin={isAdmin}
              required
            />
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
            <Field label="Notes (line items, additional charges)" htmlFor="inotes">
              <Textarea id="inotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </Field>
          </CardContent>
        </Card>

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
                value={boothBrandRows[idx] ?? { brand_name: '', expressions: [] }}
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

        <Card>
          <CardHeader>
            <CardTitle>Signed PDF</CardTitle>
            <CardDescription>Upload the executed agreement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Signed contract PDF" htmlFor="ipdf">
              <Input
                id="ipdf"
                type="file"
                accept="application/pdf"
                required
                className="cursor-pointer font-sans text-sm"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </Field>
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
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
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
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
