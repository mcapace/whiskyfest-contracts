import type { NyweBillingFields } from '@/lib/nywe-billing';

type ColumnMap = {
  billingFirst: number;
  billingLast: number;
  billingEmail: number;
  billingCompany: number;
  billingStreet: number;
  city: number;
  state: number;
  zip: number;
  country: number;
};

function cell(row: string[], index: number): string {
  const v = row[index];
  return v != null ? String(v).trim() : '';
}

/** Billing columns from a Google Sheets exhibitor roster row. */
export function billingFieldsFromRosterRow(row: string[], map: ColumnMap): NyweBillingFields | null {
  const billingFirst = cell(row, map.billingFirst);
  const billingLast = cell(row, map.billingLast);
  const billing_contact_name = [billingFirst, billingLast].filter(Boolean).join(' ').trim() || null;
  const billing_contact_email = cell(row, map.billingEmail) || null;
  const billing_address_line1 = cell(row, map.billingStreet) || null;
  const billing_city = cell(row, map.city) || null;
  const billing_state = cell(row, map.state) || null;
  const billing_zip = cell(row, map.zip) || null;
  const billing_country = cell(row, map.country) || null;

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
