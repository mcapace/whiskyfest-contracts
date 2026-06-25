import type { NyweBillingFields } from '@/lib/nywe-billing';
import type { Contract } from '@/types/db';

export type RosterAddressColumnMap = {
  wineryStreet: number;
  billingFirst: number;
  billingLast: number;
  billingEmail: number;
  billingCompany: number;
  billingStreet: number;
  billingCity: number;
  billingState: number;
  billingZip: number;
  billingCountry: number;
};

export type ExhibitorAddressFromRoster = Pick<
  Contract,
  | 'exhibitor_address_line1'
  | 'exhibitor_address_line2'
  | 'exhibitor_city'
  | 'exhibitor_state'
  | 'exhibitor_zip'
  | 'exhibitor_country'
>;

function cell(row: string[], index: number): string {
  const v = row[index];
  return v != null ? String(v).trim() : '';
}

/** Winery street from the roster (mailing / physical address on the license). */
export function exhibitorAddressFromRosterRow(
  row: string[],
  map: RosterAddressColumnMap,
): ExhibitorAddressFromRoster | null {
  const exhibitor_address_line1 = cell(row, map.wineryStreet) || null;
  if (!exhibitor_address_line1) return null;

  return {
    exhibitor_address_line1,
    exhibitor_address_line2: null,
    exhibitor_city: null,
    exhibitor_state: null,
    exhibitor_zip: null,
    exhibitor_country: null,
  };
}

/** Billing columns from a Google Sheets exhibitor roster row. */
export function billingFieldsFromRosterRow(row: string[], map: RosterAddressColumnMap): NyweBillingFields | null {
  const billingFirst = cell(row, map.billingFirst);
  const billingLast = cell(row, map.billingLast);
  const billing_contact_name = [billingFirst, billingLast].filter(Boolean).join(' ').trim() || null;
  const billing_contact_email = cell(row, map.billingEmail) || null;
  const billing_address_line1 = cell(row, map.billingStreet) || null;
  const billing_city = cell(row, map.billingCity) || null;
  const billing_state = cell(row, map.billingState) || null;
  const billing_zip = cell(row, map.billingZip) || null;
  const billing_country = cell(row, map.billingCountry) || null;

  const hasAny = Boolean(
    billing_contact_name || billing_contact_email || billing_address_line1 || billing_city || billing_state,
  );
  if (!hasAny) return null;

  return {
    billing_contact_name,
    billing_contact_email,
    billing_address_line1,
    billing_address_line2: null,
    billing_city,
    billing_state,
    billing_zip,
    billing_country,
    billing_same_as_corporate: false,
  };
}
