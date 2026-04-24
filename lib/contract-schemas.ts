import { z } from 'zod';
import { MAX_LINE_ITEM_AMOUNT_CENTS } from '@/lib/contract-line-items';

const lineItemInputSchema = z.object({
  description: z.string().min(1).max(200),
  amount_cents: z.number().int().min(0).max(MAX_LINE_ITEM_AMOUNT_CENTS),
});

/**
 * New contract (POST) and full draft update (PATCH when status = draft).
 * Mailing address, billing, and event contact are collected from the exhibitor via DocuSign text tabs.
 */
export const newContractBodySchema = z.object({
  event_id: z.string().uuid(),
  exhibitor_legal_name: z.string().min(1),
  exhibitor_company_name: z.string().min(1),
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
  line_items: z.array(lineItemInputSchema).optional().default([]),
});

export type NewContractBody = z.infer<typeof newContractBodySchema>;

/** Billing + mailing columns are not rep-edited; cleared until exhibitor DocuSign capture. */
export function clearedRepEnteredBilling() {
  return {
    exhibitor_address_line1: null as string | null,
    exhibitor_address_line2: null as string | null,
    exhibitor_city: null as string | null,
    exhibitor_state: null as string | null,
    exhibitor_zip: null as string | null,
    exhibitor_country: null as string | null,
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
  booth_rate_cents: z.number().int().min(0).optional(),
});
