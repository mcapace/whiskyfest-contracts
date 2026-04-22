import { z } from 'zod';
import { COUNTRIES } from '@/lib/countries';

const validCountries = new Set(COUNTRIES.map((c) => c.name));

/** New contract (POST) and full draft update (PATCH when status = draft). */
export const newContractBodySchema = z.object({
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
});

export type NewContractBody = z.infer<typeof newContractBodySchema>;

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
