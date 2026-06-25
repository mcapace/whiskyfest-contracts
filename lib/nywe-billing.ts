import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { billingStreetDefersToWinery } from '@/lib/exhibitor-roster-billing';
import { eventTemplateProfile } from '@/lib/contract-template-profile';
import { exhibitorFieldMergeTokens } from '@/lib/exhibitor-docusign-fields';
import type { MergePlaceholderMode } from '@/lib/merge-map';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

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

const EXHIBITOR_ADDRESS_MERGE_KEYS = [
  'exhibitor_address_line1',
  'exhibitor_address_line2',
  'exhibitor_city',
  'exhibitor_state',
  'exhibitor_zip',
  'exhibitor_country',
] as const satisfies readonly (keyof Contract)[];

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

export const NYWE_LICENSE_ADDRESS_ERROR =
  'Billing street address is required on the license. Use the billing street from the roster, or winery street when billing says "same as winery address" or is blank. Add an address in Google Sheets, then regenerate.';

/** True when line1 is a real street address (not a sheet placeholder like "same as winery"). */
export function contractHasNyweLicenseAddress(c: Pick<Contract, 'billing_address_line1'>): boolean {
  const line1 = c.billing_address_line1?.trim();
  if (!line1) return false;
  return !billingStreetDefersToWinery(line1);
}

export function nyweLicenseAddressError(
  event: Pick<Event, 'contract_template_profile'> | null | undefined,
  contract: Pick<Contract, 'billing_address_line1'>,
): string | null {
  if (!event || eventTemplateProfile(event) !== 'nywe_vendor') return null;
  if (contractHasNyweLicenseAddress(contract)) return null;
  return NYWE_LICENSE_ADDRESS_ERROR;
}

export function contractHasExhibitorAddress(
  c: Pick<
    Contract,
    | 'exhibitor_address_line1'
    | 'exhibitor_address_line2'
    | 'exhibitor_city'
    | 'exhibitor_state'
    | 'exhibitor_zip'
  >,
): boolean {
  return Boolean(
    c.exhibitor_address_line1?.trim() ||
      c.exhibitor_address_line2?.trim() ||
      c.exhibitor_city?.trim() ||
      c.exhibitor_state?.trim() ||
      c.exhibitor_zip?.trim(),
  );
}

/** Merge tokens for winery / mailing address on NYWE licenses (roster-prefilled or DocuSign anchors). */
export function nyweExhibitorAddressMergeTokens(
  contract: ContractWithTotals,
  mode: MergePlaceholderMode,
): Record<string, string> {
  const prefilled = contractHasExhibitorAddress(contract);
  const formattedAddress = formatExhibitorAddressBlock(contract);

  if (prefilled || mode === 'draft') {
    const out: Record<string, string> = {
      '{{exhibitor_address}}': formattedAddress,
    };
    for (const key of EXHIBITOR_ADDRESS_MERGE_KEYS) {
      out[`{{${key}}}`] = (contract[key] ?? '').toString().trim();
    }
    return out;
  }

  const anchors = exhibitorFieldMergeTokens('docusign');
  return {
    '{{exhibitor_address}}': '',
    ...Object.fromEntries(
      EXHIBITOR_ADDRESS_MERGE_KEYS.map((key) => [`{{${key}}}`, anchors[`{{${key}}}`] ?? '']),
    ),
  };
}

/** Merge tokens for NYWE vendor license billing block (roster-prefilled or DocuSign anchors). */
export function nyweBillingMergeTokens(
  contract: ContractWithTotals,
  mode: MergePlaceholderMode,
): Record<string, string> {
  const prefilled = contractHasNyweLicenseAddress(contract);
  const formattedAddress = formatBillingAddressBlock(contract);

  if (prefilled || mode === 'draft') {
    const out: Record<string, string> = {
      '{{billing_company_name}}':
        contract.exhibitor_legal_name?.trim() || contract.exhibitor_company_name?.trim() || '',
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
