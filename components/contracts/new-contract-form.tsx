'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency, formatLongDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ExhibitorAddressFields } from '@/components/contracts/exhibitor-address-fields';
import { SalesRepSelect } from '@/components/contracts/sales-rep-select';
import type { Event } from '@/types/db';

interface Props {
  events: Event[];
  currentUserEmail: string | null;
}

export function NewContractForm({ events, currentUserEmail }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const defaultEvent = events[0];

  const [form, setForm] = useState({
    event_id:               defaultEvent?.id ?? '',
    exhibitor_legal_name:   '',
    exhibitor_company_name: '',
    exhibitor_address_line1: '',
    exhibitor_address_line2: '',
    exhibitor_city:          '',
    exhibitor_state:         '',
    exhibitor_zip:           '',
    exhibitor_country:       'United States',
    exhibitor_telephone:    '',
    brands_poured:          '',
    booth_count:            1,
    additional_brand_count: 0,
    signer_1_name:          '',
    signer_1_title:         '',
    signer_1_email:         '',
    sales_rep_id:           '',
    notes:                  '',
  });

  const selectedEvent   = events.find(e => e.id === form.event_id);
  const boothRateCents  = selectedEvent?.booth_rate_cents ?? 1500000;
  const boothSubtotal   = form.booth_count * boothRateCents;
  const additionalFee   = form.additional_brand_count * 30000;
  const grandTotal      = boothSubtotal + additionalFee;

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const patchAddress = useCallback((patch: Partial<Pick<typeof form,
    | 'exhibitor_address_line1'
    | 'exhibitor_address_line2'
    | 'exhibitor_city'
    | 'exhibitor_state'
    | 'exhibitor_zip'
    | 'exhibitor_country'
  >>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!form.event_id) { setErr('Please select an event'); return; }
    if (!form.exhibitor_company_name) { setErr('Company name required'); return; }
    if (!form.exhibitor_legal_name)   { setErr('Legal name required'); return; }
    if (!form.exhibitor_country) { setErr('Country is required'); return; }
    if (!form.sales_rep_id) { setErr('Sales rep is required'); return; }

    startTransition(async () => {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, booth_rate_cents: boothRateCents }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Request failed (${res.status})`);
        return;
      }

      const { id } = await res.json();
      router.push(`/contracts/${id}`);
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">New Contract</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter deal terms. A draft PDF will be generated for review before anything goes to the exhibitor.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event */}
        <Card>
          <CardHeader>
            <CardTitle>Event</CardTitle>
            <CardDescription>Which WhiskyFest is this for?</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={form.event_id} onValueChange={v => set('event_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
              <SelectContent>
                {events.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {formatLongDate(e.event_date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Exhibitor info */}
        <Card>
          <CardHeader>
            <CardTitle>Exhibitor Details</CardTitle>
            <CardDescription>Legal and contact information for the contract.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Company Name" hint="Display name (e.g. 'Sample Distillery')">
              <Input value={form.exhibitor_company_name} onChange={e => set('exhibitor_company_name', e.target.value)} placeholder="Sample Distillery" required />
            </Field>
            <Field label="Legal Name" hint="Full legal entity name as it will appear in the agreement line">
              <Input value={form.exhibitor_legal_name} onChange={e => set('exhibitor_legal_name', e.target.value)} placeholder="Sample Distillery Inc." required />
            </Field>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="mb-3 text-sm font-medium">Mailing address</p>
              <ExhibitorAddressFields
                value={{
                  exhibitor_address_line1: form.exhibitor_address_line1,
                  exhibitor_address_line2: form.exhibitor_address_line2,
                  exhibitor_city: form.exhibitor_city,
                  exhibitor_state: form.exhibitor_state,
                  exhibitor_zip: form.exhibitor_zip,
                  exhibitor_country: form.exhibitor_country,
                }}
                onChange={patchAddress}
              />
            </div>
            <Field label="Telephone">
              <Input value={form.exhibitor_telephone} onChange={e => set('exhibitor_telephone', e.target.value)} placeholder="(502) 555-0100" />
            </Field>
            <Field label="Brands Poured" hint="Comma-separated list; printed on the 'List brand(s) here' line">
              <Input value={form.brands_poured} onChange={e => set('brands_poured', e.target.value)} placeholder="Sample Bourbon, Sample Rye" />
            </Field>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Booth count and additional brands — grand total updates live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Booth Count" hint={`@ ${formatCurrency(boothRateCents)} per booth`}>
                <Input type="number" min={1} value={form.booth_count}
                  onChange={e => set('booth_count', Math.max(1, parseInt(e.target.value) || 1))} />
              </Field>
              <Field label="Additional Brands" hint="@ $300 per additional brand beyond the first">
                <Input type="number" min={0} value={form.additional_brand_count}
                  onChange={e => set('additional_brand_count', Math.max(0, parseInt(e.target.value) || 0))} />
              </Field>
            </div>

            {/* Live total */}
            <div className="mt-6 rounded-lg border border-fest-600/20 bg-gradient-to-br from-fest-600/[0.07] to-whisky-50/50 p-5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Booths ({form.booth_count} × {formatCurrency(boothRateCents)})</span>
                <span className="font-mono tabular-nums">{formatCurrency(boothSubtotal)}</span>
              </div>
              {form.additional_brand_count > 0 && (
                <div className="mt-1.5 flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Additional brands ({form.additional_brand_count} × $300)</span>
                  <span className="font-mono tabular-nums">{formatCurrency(additionalFee)}</span>
                </div>
              )}
              <div className="mt-4 flex items-baseline justify-between border-t border-fest-600/15 pt-3">
                <span className="font-serif text-lg font-semibold">Grand Total</span>
                <span className="font-serif text-2xl font-semibold tabular-nums text-fest-900">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signer */}
        <Card>
          <CardHeader>
            <CardTitle>Signatory</CardTitle>
            <CardDescription>Who signs on behalf of the exhibitor?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><Input value={form.signer_1_name} onChange={e => set('signer_1_name', e.target.value)} placeholder="Jane Sampleson" /></Field>
              <Field label="Title"><Input value={form.signer_1_title} onChange={e => set('signer_1_title', e.target.value)} placeholder="VP Marketing" /></Field>
            </div>
            <Field label="Email" hint="DocuSign sends the signing request to this address (exhibitor signer).">
              <Input type="email" value={form.signer_1_email} onChange={e => set('signer_1_email', e.target.value)} placeholder="jane@sampledistillery.com" />
            </Field>
            <SalesRepSelect
              currentUserEmail={currentUserEmail}
              value={form.sales_rep_id}
              onChange={(v) => set('sales_rep_id', v)}
              required
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
            <CardDescription>Only visible to your team. Not printed on the contract.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any context for your team…" rows={3} />
          </CardContent>
        </Card>

        {/* Error */}
        {err && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/">Cancel</Link>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Contract
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
