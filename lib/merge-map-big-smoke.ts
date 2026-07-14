import { buildNyweVendorMergeMap } from '@/lib/merge-map-nywe';
import type { ContractWithTotals, Event } from '@/types/db';
import type { MergePlaceholderMode } from '@/lib/merge-map';

/**
 * Big Smoke exhibitor contract merge tokens.
 * Starts from the NYWE vendor map (fee + exhibitor + signatory) and adds package aliases
 * plus phone/email for the Festival Sponsor signature block.
 */
export function buildBigSmokeMergeMap(
  contract: ContractWithTotals,
  event: Event,
  mode: MergePlaceholderMode,
): Record<string, string> {
  const base = buildNyweVendorMergeMap(contract, event, mode);
  const fee = base['{{license_fee}}'] ?? '';

  const phone = (contract.exhibitor_telephone ?? '').trim();
  const email =
    (contract.event_contact_email ?? '').trim() || (contract.signer_1_email ?? '').trim();

  // Prefer prefilled phone/email; keep DocuSign anchors from base map when empty on send.
  if (phone) {
    base['{{exhibitor_telephone}}'] = phone;
  }
  if (email) {
    base['{{event_contact_email}}'] = email;
  }

  // Silence unused mode (kept for API parity with other merge builders).
  void mode;

  return {
    ...base,
    '{{package_fee}}': fee,
    '{{package_fee_balance}}': base['{{license_fee_balance}}'] ?? fee,
    '{{event_name}}': event.name,
    '{{event_location}}': event.location ?? '',
    '{{event_tagline}}': event.tagline ?? '',
  };
}
