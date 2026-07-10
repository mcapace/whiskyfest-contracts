import { z } from 'zod';

/** Structured edits the system applies to the contract record and Google Doc template. */
export const contractRevisionPlanSchema = z.object({
  summary: z.string().max(4000),
  field_updates: z
    .object({
      exhibitor_legal_name: z.string().max(500).optional(),
      exhibitor_company_name: z.string().max(500).optional(),
      signer_1_name: z.string().max(200).optional(),
      signer_1_email: z.string().max(200).optional(),
      signer_cc_name: z.string().max(200).optional(),
      signer_cc_email: z.string().max(200).optional(),
      brands_poured: z.string().max(2000).optional(),
      billing_address_line1: z.string().max(500).optional(),
      billing_city: z.string().max(200).optional(),
      billing_state: z.string().max(100).optional(),
      billing_zip: z.string().max(50).optional(),
      billing_country: z.string().max(100).optional(),
      payment_terms: z.string().max(500).optional(),
    })
    .optional(),
  text_replacements: z
    .array(
      z.object({
        find: z.string().min(1).max(2000),
        replace: z.string().max(2000),
        reason: z.string().max(500).optional(),
      }),
    )
    .default([]),
  text_deletions: z
    .array(
      z.object({
        find: z.string().min(1).max(2000),
        reason: z.string().max(500).optional(),
      }),
    )
    .default([]),
  /** Fallback language when a change cannot be applied inline in the template body. */
  additional_terms: z.string().max(50000).optional(),
});

export type ContractRevisionPlan = z.infer<typeof contractRevisionPlanSchema>;

export type ContractRevisionContext = {
  exhibitor_legal_name: string;
  exhibitor_company_name: string;
  signer_1_name: string;
  signer_1_email: string;
  brands_poured: string | null;
  event_name: string;
  product_label: string;
};

export function revisionPlanToDisplayLines(plan: ContractRevisionPlan): string[] {
  const lines: string[] = [];
  if (plan.summary.trim()) lines.push(plan.summary.trim());

  const fu = plan.field_updates;
  if (fu?.exhibitor_legal_name) lines.push(`Legal name → ${fu.exhibitor_legal_name}`);
  if (fu?.exhibitor_company_name) lines.push(`Company name → ${fu.exhibitor_company_name}`);
  if (fu?.signer_1_name) lines.push(`Signer → ${fu.signer_1_name}`);
  if (fu?.signer_1_email) lines.push(`Signer email → ${fu.signer_1_email}`);
  if (fu?.payment_terms) lines.push(`Payment terms → ${fu.payment_terms}`);

  for (const r of plan.text_replacements) {
    const label = r.reason?.trim() || 'Text replacement';
    lines.push(`${label}: “${r.find}” → “${r.replace}”`);
  }
  for (const d of plan.text_deletions) {
    const label = d.reason?.trim() || 'Delete text';
    lines.push(`${label}: remove “${d.find}”`);
  }
  if (plan.additional_terms?.trim()) {
    lines.push(`Additional terms (append): ${plan.additional_terms.trim().slice(0, 200)}…`);
  }
  return lines;
}

export function applyRevisionPlanFieldUpdates(
  plan: ContractRevisionPlan,
  patch: Record<string, unknown>,
): void {
  const fu = plan.field_updates;
  if (!fu) return;
  const set = (key: string, value: string | undefined) => {
    if (value?.trim()) patch[key] = value.trim();
  };
  set('exhibitor_legal_name', fu.exhibitor_legal_name);
  set('exhibitor_company_name', fu.exhibitor_company_name);
  set('signer_1_name', fu.signer_1_name);
  set('signer_1_email', fu.signer_1_email);
  set('signer_cc_name', fu.signer_cc_name);
  set('signer_cc_email', fu.signer_cc_email);
  set('brands_poured', fu.brands_poured);
  set('billing_address_line1', fu.billing_address_line1);
  set('billing_city', fu.billing_city);
  set('billing_state', fu.billing_state);
  set('billing_zip', fu.billing_zip);
  set('billing_country', fu.billing_country);
}

export function revisionAmendmentsFromPlan(plan: ContractRevisionPlan): string | null {
  const parts: string[] = [];
  if (plan.additional_terms?.trim()) parts.push(plan.additional_terms.trim());
  const fu = plan.field_updates;
  if (fu?.payment_terms?.trim()) {
    parts.push(`Payment terms: ${fu.payment_terms.trim()}`);
  }
  return parts.length ? parts.join('\n\n') : null;
}
