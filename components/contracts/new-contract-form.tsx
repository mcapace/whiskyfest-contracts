'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { emitContractActionSuccessFeedback } from '@/lib/contract-action-feedback';
import { AnimatePresence, motion } from 'framer-motion';
import { useImpersonationReadOnly } from '@/hooks/use-impersonation-read-only';
import { IMPERSONATION_BUTTON_TOOLTIP } from '@/lib/impersonation-read-only';
import { MAX_LINE_ITEM_AMOUNT_CENTS } from '@/lib/contract-line-items';
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { cn, formatCurrency, formatLongDate } from '@/lib/utils';
import { isEventsManagedWorkflow } from '@/lib/contract-template-profile';
import { isDiscountedRate, standardBoothRateCentsForEvent } from '@/lib/contracts';
import { isNyweVendorOnlyEvent, nyweLicenseFeeCents } from '@/lib/nywe-pricing';
import {
  BIG_SMOKE_PACKAGES,
  bigSmokePackageDisplayName,
  getBigSmokePackage,
  pricingFromBigSmokePackage,
  type BigSmokePackageKey,
} from '@/lib/big-smoke-pricing';
import {
  CONTRACT_DEAL_KINDS,
  dealKindMeta,
  orderTypeFromDealKind,
  type ContractDealKind,
} from '@/lib/contract-deal-kind';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SalesRepSelect } from '@/components/contracts/sales-rep-select';
import { BoothBrandInput, type BoothBrandValue } from '@/components/contracts/booth-brand-input';
import type { ContractWithTotals, Event } from '@/types/db';
import { BRAND_CATEGORIES, suggestBrandCategory, type BrandCategory } from '@/lib/brand-category';
import {
  INTERNAL_CONTRACT_NOTES_HINT,
  INTERNAL_CONTRACT_NOTES_LABEL,
  INTERNAL_CONTRACT_NOTES_PLACEHOLDER,
  SPONSOR_CONTRACT_NOTES_HINT,
  SPONSOR_CONTRACT_NOTES_LABEL,
  SPONSOR_CONTRACT_NOTES_PLACEHOLDER,
} from '@/lib/contract-notes-copy';
import { findReturningSponsor, medianBoothCountForCompany } from '@/lib/new-contract-hints';

type BoothBrandDraft = BoothBrandValue;

function boothBrandDraftsForCount(
  boothCount: number,
  initial?: { booth_index: number; brand_name: string; brand_category?: string | null; expressions: string[] }[],
  exhibitorCompany?: string,
): BoothBrandDraft[] {
  const map = new Map((initial ?? []).map((r) => [r.booth_index, r]));
  const rows: BoothBrandDraft[] = [];
  for (let i = 1; i <= boothCount; i++) {
    const r = map.get(i);
    const brand_name = r?.brand_name ?? '';
    const expressions = [...(r?.expressions ?? [])];
    const saved = r?.brand_category?.trim();
    const brand_category = (saved && BRAND_CATEGORIES.includes(saved as BrandCategory)
      ? saved
      : suggestBrandCategory(brand_name, exhibitorCompany, expressions)) as BrandCategory;
    rows.push({ brand_name, brand_category, expressions });
  }
  return rows;
}

export type ContractFormValues = {
  event_id: string;
  exhibitor_legal_name: string;
  exhibitor_company_name: string;
  booth_count: number;
  booth_rate_cents: number;
  package_key: string;
  sponsor_brand: string;
  signer_1_name: string;
  signer_1_title: string;
  signer_1_email: string;
  signer_cc_name: string;
  signer_cc_email: string;
  sales_rep_id: string;
  exhibitor_notes: string;
  notes: string;
  billing_contact_name: string;
  billing_contact_email: string;
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
  /** Recent companies + signed/executed contracts for smart defaults (Phase 3). */
  smartHints?: { recentCompanies: string[]; priorContracts: ContractWithTotals[] };
  /** Per-booth brand + expressions (loaded when editing a draft). */
  initialBoothBrands?: {
    booth_index: number;
    brand_name: string;
    brand_category?: string | null;
    expressions: string[];
  }[];
  /** Editing an admin/events import (status imported) — copy differs from draft. */
  editImportMode?: boolean;
  /** From dashboard ?deal= or edit page inference. */
  initialDealKind?: ContractDealKind;
  /** e.g. '' for WhiskyFest, '/wine-spectator' for Wine Spectator section */
  portalBasePath?: string;
  /** Stephen Senatore / Katherine Brumley complimentary booth workflow. */
  canUseNoChargeBooth?: boolean;
  /** When true (Katherine), no-charge deals must use Stephen Senatore as sales rep. */
  noChargeEnforceStephenRep?: boolean;
  stephenRepId?: string | null;
  initialNoChargeBooth?: boolean;
}

function resolveInitialDealKind(
  initialDealKind: ContractDealKind | undefined,
  initialValues: Partial<ContractFormValues> | undefined,
  initialLineItems: InitialContractLineItem[] | undefined,
): ContractDealKind {
  if (initialDealKind) return initialDealKind;
  if (initialValues?.booth_count === 0) return 'sponsorship_only';
  if ((initialLineItems?.length ?? 0) > 0) return 'booth_and_sponsorship';
  return 'booth';
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
    const dollars = amtRaw === '' ? 0 : parseFloat(amtRaw);
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
  smartHints,
  initialBoothBrands,
  editImportMode = false,
  initialDealKind,
  portalBasePath = '',
  canUseNoChargeBooth = false,
  noChargeEnforceStephenRep = false,
  stephenRepId = null,
  initialNoChargeBooth = false,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const readOnly = useImpersonationReadOnly();
  const [pending, startTransition] = useTransition();
  const busy = pending || readOnly;
  const [err, setErr] = useState<string | null>(null);

  const defaultEvent = events[0];
  const resolvedDealKind = resolveInitialDealKind(initialDealKind, initialValues, initialLineItems);
  const isSponsorshipOnly = resolvedDealKind === 'sponsorship_only';
  const defaultBoothRateCents =
    initialValues?.booth_rate_cents ??
    (defaultEvent
      ? isNyweVendorOnlyEvent(defaultEvent)
        ? nyweLicenseFeeCents(defaultEvent)
        : defaultEvent.booth_rate_cents
      : 1500000);

  const [dealKind, setDealKind] = useState<ContractDealKind>(resolvedDealKind);
  const orderType = orderTypeFromDealKind(dealKind);
  const [noChargeBooth, setNoChargeBooth] = useState(initialNoChargeBooth);
  const [sponsorBrand, setSponsorBrand] = useState(initialValues?.sponsor_brand ?? '');
  const [packageKey, setPackageKey] = useState<string>(initialValues?.package_key ?? '');

  const [form, setForm] = useState(() => ({
    event_id:               initialValues?.event_id ?? defaultEvent?.id ?? '',
    exhibitor_legal_name:   initialValues?.exhibitor_legal_name ?? '',
    exhibitor_company_name: initialValues?.exhibitor_company_name ?? '',
    booth_count:            isSponsorshipOnly ? 0 : (initialValues?.booth_count ?? 1),
    booth_rate_cents:       isSponsorshipOnly ? 0 : defaultBoothRateCents,
    signer_1_name:          initialValues?.signer_1_name ?? '',
    signer_1_title:         initialValues?.signer_1_title ?? '',
    signer_1_email:         initialValues?.signer_1_email ?? '',
    signer_cc_name:         initialValues?.signer_cc_name ?? '',
    signer_cc_email:        initialValues?.signer_cc_email ?? '',
    sales_rep_id:           initialValues?.sales_rep_id ?? '',
    exhibitor_notes:        initialValues?.exhibitor_notes ?? '',
    notes:                  initialValues?.notes ?? '',
    billing_contact_name:   initialValues?.billing_contact_name ?? '',
    billing_contact_email:  initialValues?.billing_contact_email ?? '',
    billing_address_line1:  initialValues?.billing_address_line1 ?? '',
    billing_address_line2:  initialValues?.billing_address_line2 ?? '',
    billing_city:           initialValues?.billing_city ?? '',
    billing_state:          initialValues?.billing_state ?? '',
    billing_zip:            initialValues?.billing_zip ?? '',
    billing_country:        initialValues?.billing_country ?? '',
  }));

  /** Separate from `booth_rate_cents` so typing isn't overwritten every render by .toFixed(2). */
  const [boothRateInput, setBoothRateInput] = useState(() => (defaultBoothRateCents / 100).toFixed(2));

  /** Separate from `booth_count` so `type="number"` accepts typing and spinner steps without forcing `|| 1` each keystroke. */
  const [boothCountInput, setBoothCountInput] = useState(() =>
    String(isSponsorshipOnly ? 0 : (initialValues?.booth_count ?? 1)),
  );

  const startBooths = isSponsorshipOnly ? 0 : Math.max(1, initialValues?.booth_count ?? 1);
  const [boothBrandRows, setBoothBrandRows] = useState<BoothBrandDraft[]>(() =>
    boothBrandDraftsForCount(startBooths, initialBoothBrands),
  );

  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() => {
    const rows = (initialLineItems ?? []).map((li) => ({
      key: crypto.randomUUID(),
      description: li.description,
      amountInput: (li.amount_cents / 100).toFixed(2),
    }));
    if (rows.length === 0 && resolvedDealKind === 'booth_and_sponsorship') {
      rows.push({ key: crypto.randomUUID(), description: '', amountInput: '' });
    }
    return rows;
  });

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

  const recentCompanies = smartHints?.recentCompanies ?? [];
  const priorContracts = smartHints?.priorContracts ?? [];
  const matchedSponsor = useMemo(
    () => findReturningSponsor(priorContracts, form.exhibitor_company_name),
    [priorContracts, form.exhibitor_company_name],
  );
  const medianBooths = useMemo(() => {
    const n = form.exhibitor_company_name.trim().toLowerCase();
    if (n.length < 2) return null;
    return medianBoothCountForCompany(priorContracts, n);
  }, [priorContracts, form.exhibitor_company_name]);

  const resolvedEventId =
    form.event_id && events.some((e) => e.id === form.event_id) ? form.event_id : events[0]?.id;

  useEffect(() => {
    if (!form.event_id && events[0]?.id) {
      setForm((f) => ({ ...f, event_id: events[0]!.id }));
    }
  }, [events, form.event_id]);

  const selectedEvent = events.find((e) => e.id === (resolvedEventId ?? form.event_id));
  const eventsManaged = selectedEvent ? isEventsManagedWorkflow(selectedEvent) : false;
  const isNyweFlatEvent = isNyweVendorOnlyEvent(selectedEvent);
  const isBigSmokeEvent = selectedEvent?.contract_template_profile === 'big_smoke';
  const boothOnlyEvent = isNyweFlatEvent || isBigSmokeEvent;
  const selectedBigSmokePkg = getBigSmokePackage(packageKey);
  const showNoChargeOption =
    canUseNoChargeBooth && !boothOnlyEvent && dealKind !== 'sponsorship_only';
  const listBoothRateCents = standardBoothRateCentsForEvent(selectedEvent);
  const boothSubtotal = isBigSmokeEvent
    ? (selectedBigSmokePkg?.fee_cents ?? 0)
    : form.booth_count * form.booth_rate_cents;
  const lineItemsSumCents = lineItems.reduce((acc, row) => {
    const desc = row.description.trim();
    const raw = row.amountInput.trim().replace(/[$,]/g, '');
    if (!desc && (raw === '' || raw === '.')) return acc;
    const dollars = raw === '' || raw === '.' ? 0 : parseFloat(raw);
    if (!Number.isFinite(dollars) || dollars < 0) return acc;
    return acc + Math.round(dollars * 100);
  }, 0);
  const grandTotal = boothSubtotal + lineItemsSumCents;
  const bigSmokePackagePending = isBigSmokeEvent && !selectedBigSmokePkg;

  const effectiveBoothCount = useMemo(() => {
    if (dealKind === 'sponsorship_only') return 0;
    const raw = boothCountInput.trim();
    const n = parseInt(raw, 10);
    if (raw !== '' && Number.isFinite(n) && n >= 1) return n;
    return Math.max(1, form.booth_count);
  }, [boothCountInput, form.booth_count, dealKind]);

  /** Grow-only: shrinking booth count is confirmed on blur / submit (drops excess booth data). */
  useEffect(() => {
    setBoothBrandRows((prev) => {
      if (effectiveBoothCount <= prev.length) return prev;
      const next = [...prev];
      while (next.length < effectiveBoothCount) {
        next.push({ brand_name: '', brand_category: 'Other', expressions: [] });
      }
      return next;
    });
  }, [effectiveBoothCount]);

  function boothTailHasData(rows: BoothBrandDraft[], fromIndex: number): boolean {
    return rows.slice(fromIndex).some(
      (r) => r.brand_name.trim().length > 0 || (r.expressions?.length ?? 0) > 0,
    );
  }

  function normalizeBoothCountOnBlur() {
    const n = Math.max(1, parseInt(boothCountInput.trim(), 10) || 1);
    if (n < boothBrandRows.length && boothTailHasData(boothBrandRows, n)) {
      const label =
        boothBrandRows.length === n + 1
          ? `Booth ${n + 1}`
          : `Booth ${n + 1}–${boothBrandRows.length}`;
      if (
        !window.confirm(
          `This will remove ${label} brand information. Continue?`,
        )
      ) {
        setBoothCountInput(String(boothBrandRows.length));
        setForm((f) => ({ ...f, booth_count: boothBrandRows.length }));
        return;
      }
      setBoothBrandRows((rows) => rows.slice(0, n));
    }
    setBoothCountInput(String(n));
    setForm((f) => ({ ...f, booth_count: n }));
  }

  useEffect(() => {
    if (!selectedEvent || dealKind === 'sponsorship_only') return;
    if (noChargeBooth) {
      setForm((f) => ({ ...f, booth_rate_cents: 0 }));
      setBoothRateInput('0.00');
      return;
    }
    if (isBigSmokeEvent) {
      const priced = pricingFromBigSmokePackage(packageKey);
      if (!priced) {
        // Do not inherit the event default booth rate until a package is chosen.
        setForm((f) => ({ ...f, booth_rate_cents: 0 }));
        setBoothRateInput('0.00');
        return;
      }
      setForm((f) => ({
        ...f,
        booth_count: priced.booth_count,
        booth_rate_cents: priced.booth_rate_cents,
      }));
      setBoothCountInput(String(priced.booth_count));
      setBoothRateInput((priced.booth_rate_cents / 100).toFixed(2));
      return;
    }
    const cents = isNyweFlatEvent ? nyweLicenseFeeCents(selectedEvent) : (selectedEvent.booth_rate_cents ?? 1500000);
    setForm((f) => ({
      ...f,
      booth_count: isNyweFlatEvent ? 1 : f.booth_count,
      booth_rate_cents: cents,
    }));
    setBoothRateInput((cents / 100).toFixed(2));
    if (isNyweFlatEvent) setBoothCountInput('1');
  }, [selectedEvent?.id, dealKind, isNyweFlatEvent, isBigSmokeEvent, packageKey, noChargeBooth]);

  function applyBigSmokePackage(key: string) {
    setPackageKey(key);
    const priced = pricingFromBigSmokePackage(key);
    if (!priced) return;
    setForm((f) => ({
      ...f,
      booth_count: priced.booth_count,
      booth_rate_cents: priced.booth_rate_cents,
    }));
    setBoothCountInput(String(priced.booth_count));
    setBoothRateInput((priced.booth_rate_cents / 100).toFixed(2));
  }

  function setNoChargeMode(enabled: boolean) {
    setNoChargeBooth(enabled);
    if (enabled) {
      setForm((f) => ({
        ...f,
        booth_rate_cents: 0,
        ...(noChargeEnforceStephenRep && stephenRepId ? { sales_rep_id: stephenRepId } : {}),
      }));
      setBoothRateInput('0.00');
    } else {
      const rate = selectedEvent?.booth_rate_cents ?? 1500000;
      setForm((f) => ({ ...f, booth_rate_cents: rate }));
      setBoothRateInput((rate / 100).toFixed(2));
    }
  }

  function switchDealKind(next: ContractDealKind) {
    if (next === dealKind) return;
    if (next === 'sponsorship_only') {
      const hasBoothData = boothBrandRows.some(
        (r) => r.brand_name.trim() || (r.expressions?.length ?? 0) > 0,
      );
      if (hasBoothData && !window.confirm('Switch to sponsorship only? Booth brand details will be removed.')) {
        return;
      }
      setNoChargeBooth(false);
      setDealKind('sponsorship_only');
      setBoothCountInput('0');
      setForm((f) => ({ ...f, booth_count: 0, booth_rate_cents: 0 }));
      setBoothBrandRows([]);
      if (lineItems.length === 0) {
        setLineItems([{ key: crypto.randomUUID(), description: '', amountInput: '' }]);
      }
      return;
    }
    const rate = selectedEvent?.booth_rate_cents ?? 1500000;
    setDealKind(next);
    setBoothCountInput('1');
    setForm((f) => ({ ...f, booth_count: 1, booth_rate_cents: rate }));
    setBoothRateInput((rate / 100).toFixed(2));
    setBoothBrandRows(boothBrandDraftsForCount(1, undefined, form.exhibitor_company_name));
    if (next === 'booth_and_sponsorship' && lineItems.length === 0) {
      setLineItems([{ key: crypto.randomUUID(), description: '', amountInput: '' }]);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (readOnly) return;

    if (!resolvedEventId) { setErr('Please select an event'); return; }
    if (!form.exhibitor_company_name) { setErr('Company name required'); return; }
    if (!form.exhibitor_legal_name)   { setErr('Legal name required'); return; }
    if (!eventsManaged && !form.sales_rep_id) { setErr('Sales rep is required'); return; }
    if (isBigSmokeEvent && !pricingFromBigSmokePackage(packageKey)) {
      setErr('Select a Big Smoke exhibitor package');
      return;
    }

    const useNoCharge = showNoChargeOption && noChargeBooth;
    if (useNoCharge && noChargeEnforceStephenRep && stephenRepId && form.sales_rep_id !== stephenRepId) {
      setErr('No-charge contracts must be assigned to Stephen Senatore as sales rep.');
      return;
    }

    const parsedLines = parseLineItemsForSubmit(lineItems);
    if (!parsedLines.ok) {
      setErr(parsedLines.message);
      return;
    }

    const sponsorshipOnly = dealKind === 'sponsorship_only';
    let boothCountNorm = 0;
    let rowsForSave: BoothBrandDraft[] = [];

    if (sponsorshipOnly) {
      if (parsedLines.rows.length === 0) {
        setErr('Add at least one sponsorship line item (use $0 for complimentary sponsorships).');
        return;
      }
      boothCountNorm = 0;
      rowsForSave = [];
      setBoothCountInput('0');
      setForm((f) => ({ ...f, booth_count: 0, booth_rate_cents: 0 }));
      setBoothBrandRows([]);
    } else {
      boothCountNorm = Math.max(1, parseInt(boothCountInput.trim(), 10) || 1);

      if (boothBrandRows.length > boothCountNorm && boothTailHasData(boothBrandRows, boothCountNorm)) {
        const rest = boothBrandRows.length;
        const label =
          rest === boothCountNorm + 1 ? `Booth ${boothCountNorm + 1}` : `Booth ${boothCountNorm + 1}–${rest}`;
        if (
          !window.confirm(
            `This will remove ${label} brand information. Continue?`,
          )
        ) {
          return;
        }
      }

      rowsForSave = Array.from({ length: boothCountNorm }, (_, i) => boothBrandRows[i] ?? {
        brand_name: '',
        brand_category: 'Other' as BrandCategory,
        expressions: [],
      });

      if (!boothOnlyEvent) {
        for (let i = 0; i < boothCountNorm; i++) {
          if (!rowsForSave[i].brand_name.trim()) {
            setErr(`Brand name is required for booth ${i + 1}.`);
            return;
          }
        }
      }

      setBoothBrandRows(rowsForSave.slice(0, boothCountNorm));
      setBoothCountInput(String(boothCountNorm));
      setForm((f) => ({ ...f, booth_count: boothCountNorm }));
    }

    startTransition(async () => {
      const url = editContractId ? `/api/contracts/${editContractId}` : '/api/contracts';
      const method = editContractId ? 'PATCH' : 'POST';

      const bigSmokePriced = isBigSmokeEvent ? pricingFromBigSmokePackage(packageKey) : null;
      const formForSave = {
        ...form,
        event_id: resolvedEventId,
        signer_1_title: boothOnlyEvent ? null : form.signer_1_title.trim() || null,
        booth_count: bigSmokePriced
          ? bigSmokePriced.booth_count
          : boothOnlyEvent
            ? 1
            : boothCountNorm,
        booth_rate_cents: sponsorshipOnly
          ? 0
          : useNoCharge
            ? 0
            : bigSmokePriced
              ? bigSmokePriced.booth_rate_cents
              : isNyweFlatEvent && selectedEvent
                ? nyweLicenseFeeCents(selectedEvent)
                : form.booth_rate_cents,
        package_key: isBigSmokeEvent ? packageKey : null,
      };
      const booth_brands = boothOnlyEvent
        ? []
        : rowsForSave.map((row, i) => ({
            booth_index: i + 1,
            brand_name: row.brand_name.trim(),
            brand_category: row.brand_category,
            expressions: row.expressions.filter(Boolean),
          }));
      const payload = {
        ...formForSave,
        sales_rep_id: eventsManaged ? null : form.sales_rep_id,
        order_type: orderType,
        contract_template_profile: selectedEvent?.contract_template_profile ?? 'whiskyfest',
        brands_poured: boothOnlyEvent ? form.exhibitor_company_name.trim() || null : null,
        sponsor_brand: sponsorshipOnly ? sponsorBrand.trim() || null : null,
        line_items: boothOnlyEvent ? [] : parsedLines.rows,
        booth_brands,
        no_charge_booth: useNoCharge,
      };

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
        emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
        router.push(`${portalBasePath}/contracts/${editContractId}`);
        router.refresh();
        return;
      }

      const { id } = await res.json();
      emitContractActionSuccessFeedback(Boolean(session?.user?.sound_enabled));
      router.push(`${portalBasePath}/contracts/${id}`);
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href={editContractId ? `${portalBasePath}/contracts/${editContractId}` : portalBasePath || '/'}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {editContractId ? 'Back to contract' : 'Back to dashboard'}
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {editContractId ? (editImportMode ? 'Edit imported contract' : 'Edit Contract') : 'New Contract'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {editContractId
            ? editImportMode
              ? 'Correct typos or financial details on this legacy import before releasing to accounting.'
              : 'Update draft terms before generating the PDF.'
            : 'Enter deal terms. A draft PDF will be generated for review before anything goes to the exhibitor.'}
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
        {/* Event */}
        <Card>
          <CardHeader>
            <CardTitle>Event</CardTitle>
            <CardDescription>
              {isBigSmokeEvent
                ? 'Which Big Smoke event is this exhibitor package for?'
                : isNyweFlatEvent
                  ? 'Which New York Wine Experience event is this license for?'
                  : 'Which WhiskyFest is this for?'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-destructive">No active events — contact an admin.</p>
            ) : (
              <Select
                value={resolvedEventId}
                onValueChange={(v) => set('event_id', v)}
                required
              >
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {formatLongDate(e.event_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
              <Input
                value={form.exhibitor_company_name}
                onChange={(e) => set('exhibitor_company_name', e.target.value)}
                placeholder="Sample Distillery"
                list={recentCompanies.length > 0 ? 'wf-recent-companies' : undefined}
                autoComplete="off"
                required
              />
              {recentCompanies.length > 0 ? (
                <datalist id="wf-recent-companies">
                  {recentCompanies.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              ) : null}
            </Field>
            {matchedSponsor && !boothOnlyEvent ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                <div className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  <div>
                    <p className="font-medium text-oak-900">{matchedSponsor.company} has exhibited before</p>
                    <p className="mt-1 text-xs text-amber-900/90">
                      Prior agreement: {matchedSponsor.boothCount} booths · {formatCurrency(matchedSponsor.boothRateCents)} rate
                      {matchedSponsor.brandsPoured ? ` · Brands: ${matchedSponsor.brandsPoured}` : ''}
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="mt-1 h-auto p-0 text-amber-800 underline"
                      onClick={() => {
                        set('booth_count', matchedSponsor.boothCount);
                        setBoothCountInput(String(matchedSponsor.boothCount));
                        setBoothBrandRows(boothBrandDraftsForCount(matchedSponsor.boothCount, undefined));
                        set('booth_rate_cents', matchedSponsor.boothRateCents);
                        setBoothRateInput((matchedSponsor.boothRateCents / 100).toFixed(2));
                        set(
                          'notes',
                          (form.notes ? `${form.notes}\n` : '') + 'Starting point copied from a prior signed contract.',
                        );
                      }}
                    >
                      Use prior booth terms as starting point →
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {medianBooths != null && !matchedSponsor && !boothOnlyEvent ? (
              <p className="text-xs text-muted-foreground">
                Typical booth count for this name in your history:{' '}
                <button
                  type="button"
                  className="font-medium text-amber-800 underline"
                  onClick={() => {
                    set('booth_count', medianBooths);
                    setBoothCountInput(String(medianBooths));
                    setBoothBrandRows(boothBrandDraftsForCount(medianBooths, undefined));
                  }}
                >
                  Use {medianBooths} booths
                </button>
              </p>
            ) : null}
            <Field label="Legal Name" hint="Full legal entity name as it will appear in the agreement line">
              <Input value={form.exhibitor_legal_name} onChange={e => set('exhibitor_legal_name', e.target.value)} placeholder="Sample Distillery Inc." required />
            </Field>
            {boothOnlyEvent ? (
              <div className="space-y-3 rounded-md border border-border/70 bg-muted/10 px-3 py-3">
                <p className="text-sm font-medium text-foreground">Billing information</p>
                <p className="text-xs text-muted-foreground">
                  {isBigSmokeEvent
                    ? 'Printed on the Festival Sponsor section of the agreement. Fill this in before sending — Big Smoke does not collect address fields in DocuSign.'
                    : 'Pre-filled from the exhibitor roster when created from the list. Appears on the license PDF and NYWE accounting dashboard.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Billing contact">
                    <Input value={form.billing_contact_name} onChange={(e) => set('billing_contact_name', e.target.value)} />
                  </Field>
                  <Field label="Billing email">
                    <Input type="email" value={form.billing_contact_email} onChange={(e) => set('billing_contact_email', e.target.value)} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Street / P.O. Box">
                      <Input value={form.billing_address_line1} onChange={(e) => set('billing_address_line1', e.target.value)} />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Address line 2">
                      <Input value={form.billing_address_line2} onChange={(e) => set('billing_address_line2', e.target.value)} />
                    </Field>
                  </div>
                  <Field label="City">
                    <Input value={form.billing_city} onChange={(e) => set('billing_city', e.target.value)} />
                  </Field>
                  <Field label="State">
                    <Input value={form.billing_state} onChange={(e) => set('billing_state', e.target.value)} />
                  </Field>
                  <Field label="ZIP / Postal">
                    <Input value={form.billing_zip} onChange={(e) => set('billing_zip', e.target.value)} />
                  </Field>
                  <Field label="Country (if not US)">
                    <Input value={form.billing_country} onChange={(e) => set('billing_country', e.target.value)} />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
                Mailing address, telephone, billing address, billing contact, and event contact will be collected from
                the exhibitor at signing.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>
              {isBigSmokeEvent
                ? 'Choose the rate-sheet package for this exhibitor — fee is fixed by category and booth size.'
                : isNyweFlatEvent
                  ? 'NYWE vendor licenses are a flat fee — not per-booth WhiskyFest pricing.'
                  : dealKind === 'sponsorship_only'
                    ? 'Sponsorship-only — line items only, no booth on the contract.'
                    : dealKind === 'booth_and_sponsorship'
                      ? 'Booth package plus sponsorship or activation line items on one contract (combo deal).'
                      : 'Booth package only — add line items if you later need a combo deal.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!boothOnlyEvent ? (
            <div className="space-y-2">
              <Label>Deal type</Label>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_DEAL_KINDS.map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    variant={dealKind === kind ? 'default' : 'outline'}
                    onClick={() => switchDealKind(kind)}
                    disabled={busy}
                  >
                    {dealKindMeta(kind).title}
                  </Button>
                ))}
              </div>
            </div>
            ) : null}

            {showNoChargeOption ? (
              <div className="space-y-2 rounded-lg border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
                <Label>Booth pricing</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={!noChargeBooth ? 'default' : 'outline'}
                    onClick={() => setNoChargeMode(false)}
                    disabled={busy}
                  >
                    Standard pricing
                  </Button>
                  <Button
                    type="button"
                    variant={noChargeBooth ? 'default' : 'outline'}
                    onClick={() => setNoChargeMode(true)}
                    disabled={busy}
                  >
                    No charge (complimentary booth)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Complimentary booths skip discount approval, are auto-approved for DocuSign, and appear in A/R as Do
                  Not Invoice.
                </p>
              </div>
            ) : null}

            {dealKind !== 'sponsorship_only' ? (
            isBigSmokeEvent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Exhibitor package</Label>
                  <Select
                    value={packageKey || undefined}
                    onValueChange={(v) => applyBigSmokePackage(v as BigSmokePackageKey)}
                    disabled={busy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select rate-sheet package…" />
                    </SelectTrigger>
                    <SelectContent>
                      {BIG_SMOKE_PACKAGES.map((pkg) => (
                        <SelectItem key={pkg.key} value={pkg.key}>
                          {bigSmokePackageDisplayName(pkg)} — {formatCurrency(pkg.fee_cents)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedBigSmokePkg ? (
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {bigSmokePackageDisplayName(selectedBigSmokePkg)}
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-fest-900">
                      {formatCurrency(selectedBigSmokePkg.fee_cents)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {selectedBigSmokePkg.boothLabel}
                      {selectedBigSmokePkg.booth_count > 1
                        ? ` (${selectedBigSmokePkg.booth_count} booths)`
                        : ''}
                      {' · '}Cigar Aficionado Big Smoke Las Vegas rate sheet
                    </p>
                  </div>
                ) : null}
              </div>
            ) : isNyweFlatEvent ? (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                <p className="text-sm font-medium text-foreground">Vendor license fee</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-fest-900">
                  {formatCurrency(nyweLicenseFeeCents(selectedEvent))}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Flat NYWE participation fee. Wine details come from the exhibitor roster.
                </p>
              </div>
            ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Booth Count">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={boothCountInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setBoothCountInput(raw);
                    if (raw === '') return;
                    const n = parseInt(raw, 10);
                    if (Number.isFinite(n) && n >= 1) {
                      set('booth_count', n);
                    }
                  }}
                  onBlur={() => normalizeBoothCountOnBlur()}
                />
              </Field>
              {noChargeBooth ? (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <p className="text-sm font-medium text-foreground">Complimentary booth</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-fest-900">$0.00</p>
                  <p className="mt-2 text-xs text-muted-foreground">No charge — contract total is $0 for booth fees.</p>
                </div>
              ) : (
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
                {isDiscountedRate(form.booth_rate_cents, selectedEvent) && (
                  <p className="mt-2 text-xs text-amber-700">
                    ⚠ Rates below {formatCurrency(listBoothRateCents)} require admin approval before this contract can be approved for sending or sent to DocuSign.
                  </p>
                )}
              </Field>
              )}
            </div>
            )
            ) : (
              <Field
                label="Sponsor / brand (optional)"
                hint="Shown on the contract and sponsor directory when no booth brands are listed."
              >
                <Input
                  value={sponsorBrand}
                  onChange={(e) => setSponsorBrand(e.target.value)}
                  placeholder="e.g. Acme Wines"
                  maxLength={500}
                />
              </Field>
            )}

            {dealKind !== 'sponsorship_only' && !boothOnlyEvent ? (
            <div className="space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Brands by booth</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  One brand per booth (required). Expressions are optional. Merges to{' '}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">{'{{booth_brands_block}}'}</code>{' '}
                  in the contract template.
                </p>
              </div>
              <div className="space-y-4">
                {Array.from({ length: effectiveBoothCount }).map((_, idx) => (
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
                    exhibitorCompany={form.exhibitor_company_name}
                    onChange={(next) => {
                      setBoothBrandRows((rows) => {
                        const copy = [...rows];
                        while (copy.length <= idx)
                          copy.push({ brand_name: '', brand_category: 'Other', expressions: [] });
                        copy[idx] = next;
                        return copy;
                      });
                    }}
                    disabled={busy}
                  />
                ))}
              </div>
            </div>
            ) : null}

            {!boothOnlyEvent ? (
            <div className="border-t border-border/60 pt-6">
              <h3 className="font-serif text-base font-semibold">
                {dealKind === 'sponsorship_only'
                  ? 'Sponsorship charges'
                  : dealKind === 'booth_and_sponsorship'
                    ? 'Sponsorships & add-ons'
                    : 'Additional line items'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {dealKind === 'sponsorship_only'
                  ? 'Required — describe each sponsorship; use $0 when the program is complimentary.'
                  : dealKind === 'booth_and_sponsorship'
                    ? 'Add sponsorships or activations on the same contract — use $0 when included at no charge.'
                    : 'Optional — switch to Booth + sponsorship if you need booth plus added fees.'}
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
                      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(10rem,11rem)_auto] sm:items-stretch sm:gap-x-4 sm:gap-y-1.5">
                        <div className="order-1 min-w-0 space-y-1.5 sm:order-none sm:col-start-1 sm:row-start-1">
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
                        </div>
                        <p className="order-2 text-xs text-muted-foreground sm:order-none sm:col-span-3 sm:col-start-1 sm:row-start-2">
                          {row.description.length}/200
                        </p>
                        <div className="order-3 min-w-0 space-y-1.5 sm:order-none sm:col-start-2 sm:row-start-1">
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
                            placeholder="Any amount — use 0 if complimentary"
                          />
                        </div>
                        <div className="order-4 flex items-end justify-start sm:order-none sm:col-start-3 sm:row-start-1 sm:justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove line item"
                            onClick={() =>
                              setLineItems((list) => list.filter((r) => r.key !== row.key))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
            ) : null}

            {/* Live total */}
            <div className="mt-6 rounded-lg border border-fest-600/20 bg-gradient-to-br from-fest-600/[0.07] to-whisky-50/50 p-5">
              {bigSmokePackagePending ? (
                <p className="text-sm text-muted-foreground">
                  Select a rate-sheet package above to see the package fee and total.
                </p>
              ) : (
                <>
                  {dealKind !== 'sponsorship_only' ? (
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isBigSmokeEvent ? 'Package fee' : boothOnlyEvent ? 'License fee' : 'Booth subtotal'}
                      </span>
                      <span className="font-mono tabular-nums">{formatCurrency(boothSubtotal)}</span>
                    </div>
                  ) : null}
                  {(lineItems.length > 0 || lineItemsSumCents !== 0) && (
                    <div className="mt-2 flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Line items subtotal</span>
                      <span className="font-mono tabular-nums">{formatCurrency(lineItemsSumCents)}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-baseline justify-between border-t border-fest-600/15 pt-3">
                    <span className="font-serif text-xl font-semibold">
                      {isBigSmokeEvent ? 'Package total' : boothOnlyEvent ? 'License total' : 'Contract total'}
                    </span>
                    <span className="font-serif text-2xl font-semibold tabular-nums text-fest-900">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </>
              )}
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
            <div className={cn('grid gap-4', boothOnlyEvent ? 'sm:grid-cols-1' : 'sm:grid-cols-2')}>
              <Field label="Name"><Input value={form.signer_1_name} onChange={e => set('signer_1_name', e.target.value)} placeholder="Jane Sampleson" /></Field>
              {!boothOnlyEvent ? (
                <Field label="Title"><Input value={form.signer_1_title} onChange={e => set('signer_1_title', e.target.value)} placeholder="VP Marketing" /></Field>
              ) : null}
            </div>
            <Field label="Email" hint="DocuSign sends the signing request to this address (exhibitor signer).">
              <Input type="email" value={form.signer_1_email} onChange={e => set('signer_1_email', e.target.value)} placeholder="jane@sampledistillery.com" />
            </Field>
            <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">DocuSign CC (optional)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Copy an assistant or colleague on DocuSign signing emails. They receive notifications but do not sign.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CC name">
                  <Input value={form.signer_cc_name} onChange={e => set('signer_cc_name', e.target.value)} placeholder="Assistant name" />
                </Field>
                <Field label="CC email">
                  <Input type="email" value={form.signer_cc_email} onChange={e => set('signer_cc_email', e.target.value)} placeholder="assistant@company.com" />
                </Field>
              </div>
            </div>
            {!eventsManaged ? (
              <SalesRepSelect
                currentUserEmail={currentUserEmail}
                value={form.sales_rep_id}
                onChange={(v) => set('sales_rep_id', v)}
                required
                isAdmin={isAdmin}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This event is managed by the events team — no sales rep assignment required.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="border-whisky-200/60">
          <CardHeader>
            <CardTitle>What the sponsor sees on the contract</CardTitle>
            <CardDescription>
              Put deal details the client must read in the first field below. Pricing belongs in line items /
              booth fields — not internal notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-whisky-300/50 bg-whisky-50/40 p-4">
              <Field label={SPONSOR_CONTRACT_NOTES_LABEL} hint={SPONSOR_CONTRACT_NOTES_HINT}>
                <Textarea
                  value={form.exhibitor_notes}
                  onChange={(e) => set('exhibitor_notes', e.target.value)}
                  placeholder={SPONSOR_CONTRACT_NOTES_PLACEHOLDER}
                  rows={5}
                  className="bg-background"
                />
              </Field>
            </div>
            <Field label={INTERNAL_CONTRACT_NOTES_LABEL} hint={INTERNAL_CONTRACT_NOTES_HINT}>
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder={INTERNAL_CONTRACT_NOTES_PLACEHOLDER}
                rows={3}
                maxLength={20000}
              />
            </Field>
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
            <Link href={portalBasePath || '/'}>Cancel</Link>
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
