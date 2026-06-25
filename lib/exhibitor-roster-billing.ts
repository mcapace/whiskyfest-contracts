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

export type ResolvedRosterContractAddress = {
  line1: string;
  /** True when the sheet billing street cell defers to the winery column. */
  sameAsWinery: boolean;
  /** True when line1 came from the winery street column (fallback or same-as). */
  usedWineryStreet: boolean;
};

export const ROSTER_MISSING_ADDRESS_MESSAGE =
  'Missing billing or winery street address — add one in Google Sheets before creating or sending this license.';

function cell(row: string[], index: number): string {
  const v = row[index];
  return v != null ? String(v).trim() : '';
}

/** Billing street cell tells us to use the winery address instead of literal billing text. */
export function billingStreetDefersToWinery(billingStreet: string): boolean {
  const v = billingStreet.trim().toLowerCase();
  if (!v) return false;
  if (/\bsame\s+as\s+(the\s+)?winery\b/.test(v)) return true;
  if (/\bsame\s+as\s+(the\s+)?(winery\s+)?address\b/.test(v)) return true;
  if (/\bsame\s+as\s+above\b/.test(v)) return true;
  if (/^same(\s+as\s+winery(\s+address)?)?[.!]?$/.test(v)) return true;
  return false;
}

/**
 * Contract street line for NYWE licenses:
 * 1. Billing street when it is a real address
 * 2. Winery street when billing says "same as winery" or billing is blank
 */
export function resolveRosterContractStreetAddress(
  row: string[],
  map: RosterAddressColumnMap,
): ResolvedRosterContractAddress | null {
  const billingRaw = cell(row, map.billingStreet);
  const winery = cell(row, map.wineryStreet);

  if (billingRaw && !billingStreetDefersToWinery(billingRaw)) {
    return { line1: billingRaw, sameAsWinery: false, usedWineryStreet: false };
  }

  if (winery) {
    return {
      line1: winery,
      sameAsWinery: Boolean(billingRaw && billingStreetDefersToWinery(billingRaw)),
      usedWineryStreet: true,
    };
  }

  return null;
}

export function rosterRowHasContractAddress(row: string[], map: RosterAddressColumnMap): boolean {
  return resolveRosterContractStreetAddress(row, map) != null;
}

/** Billing + resolved street for NYWE license PDF merge. */
export function billingFieldsFromRosterRow(row: string[], map: RosterAddressColumnMap): NyweBillingFields | null {
  const resolved = resolveRosterContractStreetAddress(row, map);
  if (!resolved) return null;

  const billingFirst = cell(row, map.billingFirst);
  const billingLast = cell(row, map.billingLast);
  const billing_contact_name = [billingFirst, billingLast].filter(Boolean).join(' ').trim() || null;
  const billing_contact_email = cell(row, map.billingEmail) || null;
  const billing_city = cell(row, map.billingCity) || null;
  const billing_state = cell(row, map.billingState) || null;
  const billing_zip = cell(row, map.billingZip) || null;
  const billing_country = cell(row, map.billingCountry) || null;

  return {
    billing_contact_name,
    billing_contact_email,
    billing_address_line1: resolved.line1,
    billing_address_line2: null,
    billing_city,
    billing_state,
    billing_zip,
    billing_country,
    billing_same_as_corporate: resolved.usedWineryStreet,
  };
}

/** @deprecated Winery-only exhibitor fields — NYWE contract address lives on billing_* columns. */
export type ExhibitorAddressFromRoster = Pick<
  Contract,
  | 'exhibitor_address_line1'
  | 'exhibitor_address_line2'
  | 'exhibitor_city'
  | 'exhibitor_state'
  | 'exhibitor_zip'
  | 'exhibitor_country'
>;
