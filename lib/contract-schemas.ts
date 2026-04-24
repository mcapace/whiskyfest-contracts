import { z } from 'zod';
import { COUNTRIES } from '@/lib/countries';
import { MAX_LINE_ITEM_AMOUNT_CENTS } from '@/lib/contract-line-items';

const validCountries = new Set(COUNTRIES.map((c) => c.name));

const lineItemInputSchema = z.object({
  description: z.string().min(1).max(200),
  amount_cents: z.number().int().min(0).max(MAX_LINE_ITEM_AMOUNT_CENTS),
});

/** New contract (POST) and full draft update (PATCH when status = draft). */
export const newContractBodySchema = z
  .object({
    event_id: z.string().uuid(),
    exhibitor_legal_name: z.string().min(1),
    exhibitor_company_name: z.string().min(1),
    exhibitor_address_line1: z.string().optional().nullable(),
    exhibitor_address_line2: z.string().optional().nullable(),
    exhibitor_city: z.string().optional().nullable(),
    exhibitor_state: z.string().max(120).optional().nullable(),
    exhibitor_zip: z.string().max(24).optional().nullable(),
    exhibitor_country: z.string().min(2).max(120),
    exhibitor_telephone: z.string().optional().nullable(),
    brands_poured: z.string().optional().nullable(),
    booth_count: z.number().int().min(1),
    booth_rate_cents: z.number().int().min(0),
    additional_brand_count: z.number().int().min(0).optional(),
    signer_1_name: z.string().optional().nullable(),
    signer_1_title: z.string().optional().nullable(),
    signer_1_email: z.string().email().optional().or(z.literal('')).nullable(),
    sales_rep_id: z.string().uuid({ message: 'Sales Rep is required' }),
    notes: z.string().optional().nullable(),
    billing_same_as_corporate: z.boolean().optional().default(true),
    billing_address_line1: z.string().optional().nullable(),
    billing_address_line2: z.string().optional().nullable(),
    billing_city: z.string().optional().nullable(),
    billing_state: z.string().max(120).optional().nullable(),
    billing_zip: z.string().max(24).optional().nullable(),
    billing_country: z.string().max(120).optional().nullable(),
    line_items: z.array(lineItemInputSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.billing_same_as_corporate) return;

    const line1 = data.billing_address_line1?.trim() ?? '';
    if (line1.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing address line 1 is required when billing differs from mailing.',
        path: ['billing_address_line1'],
      });
    }

    const city = data.billing_city?.trim() ?? '';
    if (!city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing city is required when billing differs from mailing.',
        path: ['billing_city'],
      });
    }

    const state = data.billing_state?.trim() ?? '';
    if (!state) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing state / region is required when billing differs from mailing.',
        path: ['billing_state'],
      });
    }

    const zip = data.billing_zip?.trim() ?? '';
    if (!zip) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing ZIP / postal code is required when billing differs from mailing.',
        path: ['billing_zip'],
      });
    }

    const country = data.billing_country?.trim() ?? '';
    if (!country) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing country is required when billing differs from mailing.',
        path: ['billing_country'],
      });
    } else if (!validCountries.has(country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing country must be one of the supported countries.',
        path: ['billing_country'],
      });
    }
  });

export type NewContractBody = z.infer<typeof newContractBodySchema>;

/** When same-as-corporate, clear billing_* on write. Otherwise keep validated billing fields. */
export function normalizedBillingColumns(p: NewContractBody) {
  if (p.billing_same_as_corporate) {
    return {
      billing_same_as_corporate: true as const,
      billing_address_line1: null as string | null,
      billing_address_line2: null as string | null,
      billing_city: null as string | null,
      billing_state: null as string | null,
      billing_zip: null as string | null,
      billing_country: null as string | null,
    };
  }
  return {
    billing_same_as_corporate: false as const,
    billing_address_line1: p.billing_address_line1?.trim() ?? null,
    billing_address_line2: p.billing_address_line2?.trim() ? p.billing_address_line2.trim() : null,
    billing_city: p.billing_city?.trim() ?? null,
    billing_state: p.billing_state?.trim() ?? null,
    billing_zip: p.billing_zip?.trim() ?? null,
    billing_country: p.billing_country?.trim() ?? null,
  };
}

export const signerContactPatchSchema = z.object({
  signer_1_name: z.string().min(1),
  signer_1_title: z.string().optional().nullable(),
  signer_1_email: z.string().email(),
  exhibitor_address_line1: z.string().trim().min(3),
  exhibitor_address_line2: z.string().trim().optional().nullable(),
  exhibitor_city: z.string().trim().min(1),
  exhibitor_state: z.string().trim().min(1),
  exhibitor_zip: z.string().trim().min(1),
  booth_rate_cents: z.number().int().min(0).optional(),
  exhibitor_country: z
    .string()
    .trim()
    .min(1)
    .refine((name) => validCountries.has(name), 'Country must be one of the supported countries'),
});
