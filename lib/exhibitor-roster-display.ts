/** Client-safe display helpers for NYWE exhibitor roster rows. */

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

/** Best-effort single-line contract/billing address for review lists. */
export function rosterAddressPreview(row: RosterAddressPreviewInput): string {
  const line1 =
    row.contractBillingLine1?.trim() || row.billingStreet?.trim() || row.wineryAddress?.trim() || '';
  const city = row.contractBillingCity?.trim() || row.billingCity?.trim() || '';
  const state = row.contractBillingState?.trim() || row.billingState?.trim() || '';
  const zip = row.contractBillingZip?.trim() || '';
  const cityLine = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [line1, cityLine].filter(Boolean).join(' · ') || '—';
}

export function rosterAddressMissing(row: RosterAddressPreviewInput): boolean {
  const preview = rosterAddressPreview(row);
  return preview === '—' || !preview.trim();
}
