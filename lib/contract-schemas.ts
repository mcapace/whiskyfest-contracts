import { z } from 'zod';
import { BRAND_CATEGORIES } from '@/lib/brand-category';
import { isBigSmokePackageKey } from '@/lib/big-smoke-pricing';
import { CONTRACT_ORDER_TYPES } from '@/lib/contract-order-type';
import { CONTRACT_TEMPLATE_PROFILES } from '@/lib/contract-template-profile';
import { MAX_LINE_ITEM_AMOUNT_CENTS } from '@/lib/contract-line-items';

const lineItemInputSchema = z.object({
  description: z.string().min(1).max(200),
  amount_cents: z.number().int().min(0).max(MAX_LINE_ITEM_AMOUNT_CENTS),
});

const boothBrandInputSchema = z.object({
  booth_index: z.number().int().min(1),
  brand_name: z.string().max(500),
  brand_category: z.enum(BRAND_CATEGORIES).optional().default('Other'),
  expressions: z.array(z.string().max(200)).optional().default([]),
});

/**
 * New contract (POST) and full draft update (PATCH when status = draft).
 * Mailing address, telephone, billing, and event contact are collected from the exhibitor via DocuSign text tabs.
 */
export const newContractBodySchema = z
  .object({
    event_id: z.string().uuid(),
    exhibitor_legal_name: z.string().min(1),
    exhibitor_company_name: z.string().min(1),
    order_type: z.enum(CONTRACT_ORDER_TYPES).optional().default('booth'),
    brands_poured: z.string().optional().nullable(),
    sponsor_brand: z.string().max(500).optional().nullable(),
    booth_count: z.number().int().min(0),
    booth_rate_cents: z.number().int().min(0),
    additional_brand_count: z.number().int().min(0).optional(),
    signer_1_name: z.string().optional().nullable(),
    signer_1_title: z.string().optional().nullable(),
    signer_1_email: z.string().email().optional().or(z.literal('')).nullable(),
    signer_cc_name: z.string().max(200).optional().nullable(),
    signer_cc_email: z.string().email().optional().or(z.literal('')).nullable(),
    sales_rep_id: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().uuid({ message: 'Sales Rep is required' }).optional().nullable(),
    ),
    /** Sent by the order form so NYWE vendor licenses skip WhiskyFest booth-brand rules. */
    contract_template_profile: z.enum(CONTRACT_TEMPLATE_PROFILES).optional(),
    /** Big Smoke rate-sheet package key. */
    package_key: z.string().max(80).optional().nullable(),
    notes: z.string().max(20000).optional().nullable(),
    exhibitor_notes: z.string().max(50000).optional().nullable(),
    billing_contact_name: z.string().max(200).optional().nullable(),
    billing_contact_email: z.string().email().optional().or(z.literal('')).nullable(),
    billing_address_line1: z.string().max(200).optional().nullable(),
    billing_address_line2: z.string().max(200).optional().nullable(),
    billing_city: z.string().max(100).optional().nullable(),
    billing_state: z.string().max(50).optional().nullable(),
    billing_zip: z.string().max(20).optional().nullable(),
    billing_country: z.string().max(100).optional().nullable(),
    line_items: z.array(lineItemInputSchema).optional().default([]),
    booth_brands: z.array(boothBrandInputSchema).optional().default([]),
    /** Complimentary WhiskyFest booth — Stephen Senatore / Katherine Brumley only. */
    no_charge_booth: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const ccEmail = data.signer_cc_email?.trim();
    const signerEmail = data.signer_1_email?.trim();
    if (ccEmail && signerEmail && ccEmail.toLowerCase() === signerEmail.toLowerCase()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CC email must differ from the exhibitor signer email.',
        path: ['signer_cc_email'],
      });
    }

    const orderType = data.order_type ?? 'booth';

    if (orderType === 'sponsorship_only') {
      if (data.booth_count !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Sponsorship-only contracts must have booth count 0.',
          path: ['booth_count'],
        });
        return;
      }
      if (data.booth_rate_cents !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Sponsorship-only contracts must have booth rate 0.',
          path: ['booth_rate_cents'],
        });
        return;
      }
      const sponsorshipLines = (data.line_items ?? []).filter((row) => row.description?.trim());
      if (sponsorshipLines.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Add at least one sponsorship line item (use $0 for complimentary sponsorships).',
          path: ['line_items'],
        });
      }
      return;
    }

    if (data.booth_count < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Booth count must be at least 1 for booth contracts.',
        path: ['booth_count'],
      });
      return;
    }

    if (data.no_charge_booth) {
      if (data.contract_template_profile === 'nywe_vendor') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No-charge booth is not available for NYWE vendor licenses.',
          path: ['no_charge_booth'],
        });
        return;
      }
      if (data.booth_rate_cents !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'No-charge booth contracts must have booth rate $0.',
          path: ['booth_rate_cents'],
        });
      }
      return;
    }

    if (data.contract_template_profile === 'nywe_vendor') {
      return;
    }

    if (data.contract_template_profile === 'big_smoke') {
      // Sponsorship-only uses line-item amounts (like WhiskyFest); booth deals need a rate-sheet package.
      if (data.order_type === 'sponsorship_only') return;
      const key = data.package_key?.trim() ?? '';
      if (!isBigSmokePackageKey(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a Big Smoke exhibitor package.',
          path: ['package_key'],
        });
      }
      return;
    }

    const seen = new Set<number>();
    for (const row of data.booth_brands ?? []) {
      if (seen.has(row.booth_index)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Each booth_index may appear only once in booth_brands.',
          path: ['booth_brands'],
        });
        return;
      }
      seen.add(row.booth_index);
      if (row.booth_index > data.booth_count) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'booth_brands booth_index cannot exceed booth_count.',
          path: ['booth_brands'],
        });
        return;
      }
    }
    const byIndex = new Map((data.booth_brands ?? []).map((r) => [r.booth_index, r]));
    for (let i = 1; i <= data.booth_count; i++) {
      const row = byIndex.get(i);
      if (!row?.brand_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Brand name is required for booth ${i}.`,
          path: ['booth_brands'],
        });
        return;
      }
    }
  });

export type NewContractBody = z.infer<typeof newContractBodySchema>;

export function firstContractBodyValidationError(flat: ReturnType<z.ZodError['flatten']>): string {
  for (const msgs of Object.values(flat.fieldErrors)) {
    if (Array.isArray(msgs) && typeof msgs[0] === 'string') return msgs[0];
  }
  const formErr = flat.formErrors[0];
  return typeof formErr === 'string' ? formErr : 'Invalid input';
}

/** Exhibitor-provided columns (mailing, phone, billing) are not rep-edited; cleared until DocuSign capture. */
export function clearedRepEnteredBilling() {
  return {
    exhibitor_address_line1: null as string | null,
    exhibitor_address_line2: null as string | null,
    exhibitor_city: null as string | null,
    exhibitor_state: null as string | null,
    exhibitor_zip: null as string | null,
    exhibitor_country: null as string | null,
    exhibitor_telephone: null as string | null,
    billing_same_as_corporate: true as const,
    billing_address_line1: null as string | null,
    billing_address_line2: null as string | null,
    billing_city: null as string | null,
    billing_state: null as string | null,
    billing_zip: null as string | null,
    billing_country: null as string | null,
  };
}

export const signerContactPatchSchema = z.object({
  signer_1_name: z.string().min(1),
  signer_1_title: z.string().optional().nullable(),
  signer_1_email: z.string().email(),
  signer_cc_name: z.string().max(200).optional().nullable(),
  signer_cc_email: z.string().email().optional().or(z.literal('')).nullable(),
  booth_rate_cents: z.number().int().min(0).optional(),
}).superRefine((data, ctx) => {
  const ccEmail = data.signer_cc_email?.trim();
  const signerEmail = data.signer_1_email?.trim();
  if (ccEmail && signerEmail && ccEmail.toLowerCase() === signerEmail.toLowerCase()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CC email must differ from the exhibitor signer email.',
      path: ['signer_cc_email'],
    });
  }
});

export function sponsorBrandFromBody(p: Pick<NewContractBody, 'order_type' | 'sponsor_brand' | 'brands_poured'>): string | null {
  if (p.order_type !== 'sponsorship_only') return null;
  const text = (p.sponsor_brand ?? p.brands_poured ?? '').trim();
  return text || null;
}
