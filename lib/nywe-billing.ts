import { formatBillingAddressBlock } from '@/lib/exhibitor-address';
import { exhibitorFieldMergeTokens } from '@/lib/exhibitor-docusign-fields';
import type { MergePlaceholderMode } from '@/lib/merge-map';
import type { Contract, ContractWithTotals } from '@/types/db';

export type NyweBillingFields = Pick<
  Contract,
  | 'billing_contact_name'
  | 'billing_contact_email'
  | 'billing_same_as_corporate'
  | 'billing_address_line1'
  | 'billing_address_line2'
  | 'billing_city'
  | 'billing_state'
  | 'billing_zip'
  | 'billing_country'
>;

const BILLING_MERGE_KEYS = [
  'billing_contact_name',
  'billing_contact_email',
  'billing_address_line1',
  'billing_address_line2',
  'billing_city',
  'billing_state',
  'billing_zip',
  'billing_country',
] as const satisfies readonly (keyof NyweBillingFields)[];

export function contractHasBillingInfo(
  c: Pick<
    Contract,
    | 'billing_contact_name'
    | 'billing_contact_email'
    | 'billing_address_line1'
    | 'billing_city'
    | 'billing_state'
  >,
): boolean {
  return Boolean(
    c.billing_contact_name?.trim() ||
      c.billing_contact_email?.trim() ||
      c.billing_address_line1?.trim() ||
      c.billing_city?.trim() ||
      c.billing_state?.trim(),
  );
}

/** Merge tokens for NYWE vendor license billing block (roster-prefilled or DocuSign anchors). */
export function nyweBillingMergeTokens(
  contract: ContractWithTotals,
  mode: MergePlaceholderMode,
): Record<string, string> {
  const prefilled = contractHasBillingInfo(contract);
  const formattedAddress = formatBillingAddressBlock(contract);

  if (prefilled || mode === 'draft') {
    const out: Record<string, string> = {
      '{{billing_company_name}}': contract.exhibitor_legal_name?.trim() || contract.exhibitor_company_name,
      '{{billing_address}}': formattedAddress,
    };
    for (const key of BILLING_MERGE_KEYS) {
      out[`{{${key}}}`] = (contract[key] ?? '').toString().trim();
    }
    return out;
  }

  const anchors = exhibitorFieldMergeTokens('docusign');
  return {
    '{{billing_company_name}}': contract.exhibitor_legal_name?.trim() || contract.exhibitor_company_name,
    '{{billing_address}}': '',
    ...Object.fromEntries(
      BILLING_MERGE_KEYS.map((key) => [`{{${key}}}`, anchors[`{{${key}}}`] ?? '']),
    ),
  };
}

export function billingFieldsFromOptionalBody(body: {
  billing_contact_name?: string | null;
  billing_contact_email?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip?: string | null;
  billing_country?: string | null;
}): NyweBillingFields | null {
  const billing_contact_name = body.billing_contact_name?.trim() || null;
  const billing_contact_email = body.billing_contact_email?.trim() || null;
  const billing_address_line1 = body.billing_address_line1?.trim() || null;
  const billing_address_line2 = body.billing_address_line2?.trim() || null;
  const billing_city = body.billing_city?.trim() || null;
  const billing_state = body.billing_state?.trim() || null;
  const billing_zip = body.billing_zip?.trim() || null;
  const billing_country = body.billing_country?.trim() || null;

  const hasAny = Boolean(
    billing_contact_name ||
      billing_contact_email ||
      billing_address_line1 ||
      billing_city ||
      billing_state,
  );
  if (!hasAny) return null;

  return {
    billing_contact_name,
    billing_contact_email,
    billing_address_line1,
    billing_address_line2,
    billing_city,
    billing_state,
    billing_zip,
    billing_country,
    billing_same_as_corporate: false,
  };
}
