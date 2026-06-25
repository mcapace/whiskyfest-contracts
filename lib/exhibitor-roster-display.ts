/** Client-safe display helpers for NYWE exhibitor roster rows. */

import {
  billingStreetDefersToWinery,
  resolveContractStreetFromSheetCells,
} from '@/lib/exhibitor-roster-billing';

export type RosterAddressPreviewInput = {
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  wineryAddress?: string;
  contractBillingLine1?: string | null;
  contractBillingCity?: string | null;
  contractBillingState?: string | null;
  contractBillingZip?: string | null;
};

function resolvedStreetLine(row: RosterAddressPreviewInput): string {
  const stored = row.contractBillingLine1?.trim() ?? '';
  if (stored && !billingStreetDefersToWinery(stored)) return stored;
  const fromSheet = resolveContractStreetFromSheetCells(
    row.billingStreet ?? '',
    row.wineryAddress ?? '',
  );
  if (fromSheet) return fromSheet.line1;
  if (stored) return stored;
  return '';
}

/** Best-effort single-line contract/billing address for review lists. */
export function rosterAddressPreview(row: RosterAddressPreviewInput): string {
  const line1 = resolvedStreetLine(row);
  const city = row.contractBillingCity?.trim() || row.billingCity?.trim() || '';
  const state = row.contractBillingState?.trim() || row.billingState?.trim() || '';
  const zip = row.contractBillingZip?.trim() || row.billingZip?.trim() || '';
  const cityLine = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [line1, cityLine].filter(Boolean).join(' · ') || '—';
}

export function rosterAddressMissing(row: RosterAddressPreviewInput): boolean {
  return !resolvedStreetLine(row);
}
