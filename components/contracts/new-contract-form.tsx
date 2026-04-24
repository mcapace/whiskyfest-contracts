'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { MAX_LINE_ITEM_AMOUNT_CENTS } from '@/lib/contract-line-items';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { formatCurrency, formatLongDate } from '@/lib/utils';
import { isDiscountedRate, STANDARD_BOOTH_RATE_CENTS } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AddressAutocomplete, type BillingAddressValue } from '@/components/forms/address-autocomplete';
import { SalesRepSelect } from '@/components/contracts/sales-rep-select';
import type { Event } from '@/types/db';

export type ContractFormValues = {
  event_id: string;
  exhibitor_legal_name: string;
  exhibitor_company_name: string;
  exhibitor_address_line1: string;
  exhibitor_address_line2: string;
  exhibitor_city: string;
  exhibitor_state: string;
  exhibitor_zip: string;
  exhibitor_country: string;
  exhibitor_telephone: string;
  brands_poured: string;
  booth_count: number;
  booth_rate_cents: number;
  signer_1_name: string;
  signer_1_title: string;
  signer_1_email: string;
  sales_rep_id: string;
  notes: string;
  billing_same_as_corporate: boolean;
  billing_address_line1: string;
  billing_address_line2: string;
  billing_city: string;
  billing_state: string;
  billing_zip: string;
  billing_country: string;
};

export type InitialContractLineItem = { description: string; amount_cents: number };

type LineItemDraft = { key: string; description: string; amountInput: string };

interface Props {
  events: Event[];
  currentUserEmail: string | null;
  /** When false, sales rep cannot change the assigned rep (dropdown locked to self). */
  isAdmin?: boolean;
  editContractId?: string;
  initialValues?: Partial<ContractFormValues>;
  initialLineItems?: InitialContractLineItem[];
}

function formatUsPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Pretty-print USD with commas for line-item amount fields (on blur). */
function formatLineItemAmountDisplay(raw: string): string {
  const cleaned = raw.replace(/[$,]/g, '').trim();
  if (cleaned === '' || cleaned === '.') return '';
  const dollars = parseFloat(cleaned);
  if (!Number.isFinite(dollars)) return raw.trim();
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function parseLineItemsForSubmit(items: LineItemDraft[]):
  | { ok: true; rows: { description: string; amount_cents: number }[] }
  | { ok: false; message: string } {
  const out: { description: string; amount_cents: number }[] = [];
  for (const row of items) {
    const d = row.description.trim();
    const amtRaw = row.amountInput.trim().replace(/[$,]/g, '');
    if (!d && !amtRaw) continue;
    if (!d) return { ok: false, message: 'Each line item needs a description (1–200 characters).' };
    if (d.length > 200) return { ok: false, message: 'Line item descriptions must be at most 200 characters.' };
    if (!amtRaw) return { ok: false, message: 'Each line item needs an amount.' };
    const dollars = parseFloat(amtRaw);
    if (!Number.isFinite(dollars) || dollars < 0) {
      return { ok: false, message: 'Line item amounts must be valid non-negative numbers.' };
    }
    const cents = Math.round(dollars * 100);
    if (cents > MAX_LINE_ITEM_AMOUNT_CENTS) {
      return { ok: false, message: 'A line item amount exceeds the maximum allowed ($1,000,000).' };
    }
    out.push({ description: d, amount_cents: cents });
  }
  return { ok: true, rows: out };
}

export function NewContractForm({
  events,
  currentUserEmail,
  isAdmin = false,
  editContractId,
  initialValues,
  initialLineItems,
}: Props) {
  const router = useRouter();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [err, setErr] = useState<string | null>(null);

  const defaultEvent = events[0];
  const defaultBoothRateCents = initialValues?.booth_rate_cents ?? defaultEvent?.booth_rate_cents ?? 1500000;

  const [form, setForm] = useState(() => ({
    event_id:               initialValues?.event_id ?? defaultEvent?.id ?? '',
    exhibitor_legal_name:   initialValues?.exhibitor_legal_name ?? '',
    exhibitor_company_name: initialValues?.exhibitor_company_name ?? '',
    exhibitor_address_line1: initialValues?.exhibitor_address_line1 ?? '',
    exhibitor_address_line2: initialValues?.exhibitor_address_line2 ?? '',
    exhibitor_city:          initialValues?.exhibitor_city ?? '',
    exhibitor_state:         initialValues?.exhibitor_state ?? '',
    exhibitor_zip:           initialValues?.exhibitor_zip ?? '',
    exhibitor_country:       initialValues?.exhibitor_country ?? 'United States',
    exhibitor_telephone:    initialValues?.exhibitor_telephone ?? '',
    brands_poured:          initialValues?.brands_poured ?? '',
    booth_count:            initialValues?.booth_count ?? 1,
    booth_rate_cents:       defaultBoothRateCents,
    signer_1_name:          initialValues?.signer_1_name ?? '',
    signer_1_title:         initialValues?.signer_1_title ?? '',
    signer_1_email:         initialValues?.signer_1_email ?? '',
    sales_rep_id:           initialValues?.sales_rep_id ?? '',
    notes:                  initialValues?.notes ?? '',
    billing_same_as_corporate: initialValues?.billing_same_as_corporate ?? true,
    billing_address_line1: initialValues?.billing_address_line1 ?? '',
    billing_address_line2: initialValues?.billing_address_line2 ?? '',
    billing_city:           initialValues?.billing_city ?? '',
    billing_state:          initialValues?.billing_state ?? '',
    billing_zip:            initialValues?.billing_zip ?? '',
    billing_country:       initialValues?.billing_country ?? 'United States',
  }));

  /** Separate from `booth_rate_cents` so typing isn't overwritten every render by .toFixed(2). */
  const [boothRateInput, setBoothRateInput] = useState(() => (defaultBoothRateCents / 100).toFixed(2));

  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() =>
    (initialLineItems ?? []).map((li) => ({
      key: crypto.randomUUID(),
      description: li.description,
      amountInput: (li.amount_cents / 100).toFixed(2),
    })),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sales-reps/me');
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { sales_rep?: { id: string } | null };
        const id = body.sales_rep?.id;
        if (!id || cancelled) return;
        setForm((f) => {
          if (f.sales_rep_id) return f;
          return { ...f, sales_rep_id: id };
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEvent = events.find(e => e.id === form.event_id);
  const boothSubtotal = form.booth_count * form.booth_rate_cents;
  const lineItemsSumCents = lineItems.reduce((acc, row) => {
    const raw = row.amountInput.trim().replace(/[$,]/g, '');
    if (raw === '' || raw === '.') return acc;
    const dollars = parseFloat(raw);
    if (!Number.isFinite(dollars) || dollars < 0) return acc;
    return acc + Math.round(dollars * 100);
  }, 0);
  const grandTotal = boothSubtotal + lineItemsSumCents;

  useEffect(() => {
    if (!selectedEvent) return;
    const cents = selectedEvent.booth_rate_cents ?? 1500000;
    setForm((f) => ({ ...f, booth_rate_cents: cents }));
    setBoothRateInput((cents / 100).toFixed(2));
  }, [selectedEvent?.id]);

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

  const patchBillingAddress = useCallback((patch: Partial<BillingAddressValue>) => {
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (readOnly) return;

    if (!form.event_id) { setErr('Please select an event'); return; }
    if (!form.exhibitor_company_name) { setErr('Company name required'); return; }
    if (!form.exhibitor_legal_name)   { setErr('Legal name required'); return; }
    if (!form.exhibitor_country) { setErr('Country is required'); return; }
    if (!form.sales_rep_id) { setErr('Sales rep is required'); return; }

    const parsedLines = parseLineItemsForSubmit(lineItems);
    if (!parsedLines.ok) {
      setErr(parsedLines.message);
      return;
    }

    startTransition(async () => {
      const url = editContractId ? `/api/contracts/${editContractId}` : '/api/contracts';
      const method = editContractId ? 'PATCH' : 'POST';

      const base =
        form.billing_same_as_corporate
          ? {
              ...form,
              billing_same_as_corporate: true,
              billing_address_line1: null,
              billing_address_line2: null,
              billing_city: null,
              billing_state: null,
              billing_zip: null,
              billing_country: null,
            }
          : form;

      const payload = { ...base, line_items: parsedLines.rows };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Request failed (${res.status})`);
        return;
      }

      if (editContractId) {
        router.push(`/contracts/${editContractId}`);
        router.refresh();
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
        <Link
          href={editContractId ? `/contracts/${editContractId}` : '/'}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {editContractId ? 'Back to contract' : 'Back to dashboard'}
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{editContractId ? 'Edit Contract' : 'New Contract'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {editContractId
            ? 'Update draft terms before generating the PDF.'
            : 'Enter deal terms. A draft PDF will be generated for review before anything goes to the exhibitor.'}
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
              <AddressAutocomplete
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

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="mb-3 text-sm font-medium">Billing address</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Invoice mailing may differ from your corporate mailing address. The signed PDF still shows only the corporate address (legal clarity).
              </p>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={form.billing_same_as_corporate}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((f) => ({
                      ...f,
                      billing_same_as_corporate: checked,
                      ...(checked
                        ? {
                            billing_address_line1: '',
                            billing_address_line2: '',
                            billing_city: '',
                            billing_state: '',
                            billing_zip: '',
                            billing_country: 'United States',
                          }
                        : {}),
                    }));
                  }}
                />
                <span>Same as mailing address</span>
              </label>

              {!form.billing_same_as_corporate && (
                <div className="mt-4">
                  <AddressAutocomplete
                    mode="billing"
                    value={{
                      billing_address_line1: form.billing_address_line1,
                      billing_address_line2: form.billing_address_line2,
                      billing_city: form.billing_city,
                      billing_state: form.billing_state,
                      billing_zip: form.billing_zip,
                      billing_country: form.billing_country,
                    }}
                    onChange={patchBillingAddress}
                  />
                </div>
              )}
            </div>

            <Field label="Telephone">
              <Input
                inputMode="tel"
                autoComplete="tel"
                value={form.exhibitor_telephone}
                onChange={(e) => set('exhibitor_telephone', formatUsPhone(e.target.value))}
                onBlur={(e) => set('exhibitor_telephone', formatUsPhone(e.target.value))}
                placeholder="(502) 555-0100"
              />
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
            <CardDescription>Booth count, booth rate, and optional line items — contract total updates live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Booth Count">
                <Input type="number" min={1} value={form.booth_count}
                  onChange={e => set('booth_count', Math.max(1, parseInt(e.target.value) || 1))} />
              </Field>
              <Field label="Booth Rate (USD)" hint="Editable for custom booth pricing">
                <Input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={boothRateInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
                    setBoothRateInput(raw);
                    if (raw === '' || raw === '.') return;
                    const dollars = parseFloat(raw);
                    if (!Number.isFinite(dollars)) return;
                    set('booth_rate_cents', Math.round(Math.max(0, dollars) * 100));
                  }}
                  onBlur={() => {
                    const raw = boothRateInput.trim();
                    if (raw === '' || raw === '.') {
                      setBoothRateInput(((form.booth_rate_cents) / 100).toFixed(2));
                      return;
                    }
                    const dollars = Math.max(0, parseFloat(raw) || 0);
                    const cents = Math.round(dollars * 100);
                    setForm((f) => ({ ...f, booth_rate_cents: cents }));
                    setBoothRateInput((cents / 100).toFixed(2));
                  }}
                />
                {isDiscountedRate(form.booth_rate_cents) && (
                  <p className="mt-2 text-xs text-amber-700">
                    ⚠ Rates below {formatCurrency(STANDARD_BOOTH_RATE_CENTS)} require admin approval before this contract can be approved for sending or sent to DocuSign.
                  </p>
                )}
              </Field>
            </div>

            <div className="border-t border-border/60 pt-6">
              <h3 className="font-serif text-base font-semibold">Additional Line Items</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sponsorships, activations, or other custom charges beyond the booth package (optional)
              </p>

              {lineItems.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No line items yet.</p>
              ) : null}

              <div className="mt-4 space-y-4">
                <AnimatePresence initial={false}>
                  {lineItems.map((row) => (
                    <motion.div
                      key={row.key}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden rounded-lg border border-border/60 bg-muted/10 p-4"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,11rem)_auto] sm:items-end">
                        <div className="min-w-0 space-y-1.5">
                          <Label>Description</Label>
                          <Input
                            value={row.description}
                            maxLength={200}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLineItems((list) =>
                                list.map((r) => (r.key === row.key ? { ...r, description: v } : r)),
                              );
                            }}
                            placeholder="e.g. Gold sponsorship"
                          />
                          <p className="text-xs text-muted-foreground">{row.description.length}/200</p>
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <Label>Amount</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={row.amountInput}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const t = raw.replace(/[$,]/g, '');
                              if (t !== '' && !/^\d*\.?\d*$/.test(t)) return;
                              setLineItems((list) =>
                                list.map((r) => (r.key === row.key ? { ...r, amountInput: raw } : r)),
                              );
                            }}
                            onBlur={() => {
                              const formatted = formatLineItemAmountDisplay(row.amountInput);
                              if (!formatted) return;
                              setLineItems((list) =>
                                list.map((r) => (r.key === row.key ? { ...r, amountInput: formatted } : r)),
                              );
                            }}
                            placeholder="$10,000.00"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="justify-self-start text-muted-foreground hover:text-destructive sm:justify-self-end"
                          title="Remove line item"
                          onClick={() =>
                            setLineItems((list) => list.filter((r) => r.key !== row.key))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() =>
                  setLineItems((list) => [
                    ...list,
                    { key: crypto.randomUUID(), description: '', amountInput: '' },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                + Add Line Item
              </Button>
            </div>

            {/* Live total */}
            <div className="mt-6 rounded-lg border border-fest-600/20 bg-gradient-to-br from-fest-600/[0.07] to-whisky-50/50 p-5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Booth subtotal</span>
                <span className="font-mono tabular-nums">{formatCurrency(boothSubtotal)}</span>
              </div>
              {lineItemsSumCents > 0 && (
                <div className="mt-2 flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Line items subtotal</span>
                  <span className="font-mono tabular-nums">{formatCurrency(lineItemsSumCents)}</span>
                </div>
              )}
              <div className="mt-4 flex items-baseline justify-between border-t border-fest-600/15 pt-3">
                <span className="font-serif text-xl font-semibold">Contract total</span>
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
              isAdmin={isAdmin}
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
          <Button type="submit" disabled={busy} title={readOnly ? IMPERSONATION_BUTTON_TOOLTIP : undefined}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editContractId ? 'Save Changes' : 'Create Contract'}
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
