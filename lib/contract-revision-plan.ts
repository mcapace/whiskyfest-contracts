import { z } from 'zod';

/**
 * Structured edits the system applies to the contract record and to the merged Google Doc.
 *
 * Persisted on `contracts.revision_plan` so every later render (send, resend, preview, draft PDF)
 * produces the same amended document. Edits are applied in this order:
 *   1. text_replacements / text_deletions — phrase-level `replaceAllText` (verified: a find that
 *      matches nothing is reported, never silently dropped)
 *   2. paragraph_edits — clause-level replace / delete / insert_after by anchor phrase, keeping
 *      the paragraph's bullet, numbering and text style
 *   3. additional_terms — numbered items in the "Additional Terms and Amendments" section (the
 *      section is removed entirely when there are none)
 */
const paragraphEditSchema = z.object({
  op: z.enum(['replace', 'delete', 'insert_after']),
  /** Distinctive phrase found in exactly one paragraph of the merged contract. */
  anchor: z.string().min(4).max(2000),
  /** New paragraph text (replace / insert_after). */
  text: z.string().max(6000).optional(),
  reason: z.string().max(500).optional(),
});

export type ContractParagraphEdit = z.infer<typeof paragraphEditSchema>;

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
      signer_2_name: z.string().max(200).optional(),
      signer_2_title: z.string().max(200).optional(),
      signer_2_email: z.string().max(200).optional(),
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
  paragraph_edits: z.array(paragraphEditSchema).default([]),
  /** Numbered items for the Additional Terms section — one per line — when a change cannot live inline. */
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

function clip(value: string, max = 90): string {
  const t = value.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function revisionPlanToDisplayLines(plan: ContractRevisionPlan): string[] {
  const lines: string[] = [];
  if (plan.summary.trim()) lines.push(plan.summary.trim());

  const fu = plan.field_updates;
  if (fu?.exhibitor_legal_name) lines.push(`Legal name → ${fu.exhibitor_legal_name}`);
  if (fu?.exhibitor_company_name) lines.push(`Company name → ${fu.exhibitor_company_name}`);
  if (fu?.signer_1_name) lines.push(`Signer → ${fu.signer_1_name}`);
  if (fu?.signer_1_email) lines.push(`Signer email → ${fu.signer_1_email}`);
  if (fu?.signer_2_name || fu?.signer_2_email) {
    lines.push(`Second signer → ${[fu.signer_2_name, fu.signer_2_email].filter(Boolean).join(' ')}`);
  }
  if (fu?.payment_terms) lines.push(`Payment terms → ${fu.payment_terms}`);

  for (const r of plan.text_replacements) {
    const label = r.reason?.trim() || 'Text replacement';
    lines.push(`${label}: “${clip(r.find)}” → “${clip(r.replace)}”`);
  }
  for (const d of plan.text_deletions) {
    const label = d.reason?.trim() || 'Delete text';
    lines.push(`${label}: remove “${clip(d.find)}”`);
  }
  for (const e of plan.paragraph_edits) {
    const label = e.reason?.trim();
    const verb =
      e.op === 'replace'
        ? 'Replace clause'
        : e.op === 'delete'
          ? 'Remove clause'
          : 'Add clause after';
    lines.push(
      `${label ? `${label}: ` : ''}${verb} “${clip(e.anchor, 60)}”${
        e.text && e.op !== 'delete' ? ` → “${clip(e.text)}”` : ''
      }`,
    );
  }
  if (plan.additional_terms?.trim()) {
    const items = splitAdditionalTermsItems(plan.additional_terms);
    lines.push(`Additional terms (${items.length} numbered item${items.length === 1 ? '' : 's'} added to the contract)`);
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
  set('signer_2_name', fu.signer_2_name);
  set('signer_2_title', fu.signer_2_title);
  set('signer_2_email', fu.signer_2_email);
  set('brands_poured', fu.brands_poured);
  set('billing_address_line1', fu.billing_address_line1);
  set('billing_city', fu.billing_city);
  set('billing_state', fu.billing_state);
  set('billing_zip', fu.billing_zip);
  set('billing_country', fu.billing_country);
}

/** One amendment per line; leading "1." / "•" / "-" markers are stripped because the Doc numbers them. */
export function splitAdditionalTermsItems(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[•●\-*]|\(?\d{1,2}[.)]|[a-z][.)])\s+/i, '').trim())
    .filter(Boolean);
}

/**
 * Text merged into {{revision_amendments}}: additional terms plus a payment-terms line when the
 * plan could not swap the phrase inline.
 */
export function revisionAmendmentsFromPlan(plan: ContractRevisionPlan): string | null {
  const items = splitAdditionalTermsItems(plan.additional_terms);
  const fu = plan.field_updates;
  const paymentTerms = fu?.payment_terms?.trim();
  if (paymentTerms) {
    const coveredInline = plan.text_replacements.some((r) =>
      r.replace.toLowerCase().includes(paymentTerms.toLowerCase()),
    );
    if (!coveredInline) items.push(`Payment terms: ${paymentTerms}.`);
  }
  return items.length ? items.join('\n') : null;
}

/** True when the plan changes the document (as opposed to only the contract record). */
export function revisionPlanHasDocumentEdits(plan: ContractRevisionPlan | null | undefined): boolean {
  if (!plan) return false;
  return (
    plan.text_replacements.length > 0 ||
    plan.text_deletions.length > 0 ||
    plan.paragraph_edits.length > 0 ||
    Boolean(plan.field_updates?.payment_terms?.trim())
  );
}

/**
 * Combine the edits already on a contract with a new round. Later rounds win on the same
 * find / anchor; field updates and summary come from the new round.
 */
export function mergeRevisionPlans(
  previous: ContractRevisionPlan | null | undefined,
  next: ContractRevisionPlan,
): ContractRevisionPlan {
  if (!previous) return next;
  const dedupe = <T>(items: T[], key: (item: T) => string): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of [...items].reverse()) {
      const k = key(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.unshift(item);
    }
    return out;
  };
  return {
    summary: next.summary || previous.summary,
    field_updates: { ...(previous.field_updates ?? {}), ...(next.field_updates ?? {}) },
    text_replacements: dedupe([...previous.text_replacements, ...next.text_replacements], (r) => r.find.toLowerCase()),
    text_deletions: dedupe([...previous.text_deletions, ...next.text_deletions], (d) => d.find.toLowerCase()),
    paragraph_edits: dedupe(
      [...previous.paragraph_edits, ...next.paragraph_edits],
      (e) => `${e.op}\0${e.anchor.toLowerCase()}`,
    ),
    additional_terms: next.additional_terms?.trim() ? next.additional_terms : previous.additional_terms,
  };
}

/** Coerce a stored jsonb value into a plan (older rows may predate paragraph_edits). */
export function parseStoredRevisionPlan(raw: unknown): ContractRevisionPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const result = contractRevisionPlanSchema.safeParse(raw);
  return result.success ? result.data : null;
}
