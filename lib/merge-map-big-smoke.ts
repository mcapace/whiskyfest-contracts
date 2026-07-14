import { buildNyweVendorMergeMap } from '@/lib/merge-map-nywe';
import {
  bigSmokePackageDisplayName,
  getBigSmokePackage,
} from '@/lib/big-smoke-pricing';
import type { ContractWithTotals, Event } from '@/types/db';
import type { MergePlaceholderMode } from '@/lib/merge-map';

/**
 * Big Smoke exhibitor contract merge tokens.
 * Starts from the NYWE vendor map (fee + exhibitor + signatory) and adds package aliases.
 */
export function buildBigSmokeMergeMap(
  contract: ContractWithTotals,
  event: Event,
  mode: MergePlaceholderMode,
): Record<string, string> {
  const base = buildNyweVendorMergeMap(contract, event, mode);
  const pkg = getBigSmokePackage(contract.package_key);
  const feeCents = pkg?.fee_cents ?? contract.grand_total_cents;
  const fee =
    feeCents != null
      ? (feeCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (base['{{license_fee}}'] ?? '');

  const phone = (contract.exhibitor_telephone ?? '').trim();
  const email =
    (contract.event_contact_email ?? '').trim() || (contract.signer_1_email ?? '').trim();

  if (phone) {
    base['{{exhibitor_telephone}}'] = phone;
  }
  if (email) {
    base['{{event_contact_email}}'] = email;
  }

  void mode;

  return {
    ...base,
    '{{license_fee}}': fee,
    '{{license_fee_balance}}': fee,
    '{{package_fee}}': fee,
    '{{package_fee_balance}}': fee,
    '{{package_name}}': pkg ? bigSmokePackageDisplayName(pkg) : '',
    '{{package_booth_label}}': pkg?.boothLabel ?? '',
    '{{package_category}}': pkg?.categoryLabel ?? '',
    '{{booth_count}}': String(pkg?.booth_count ?? contract.booth_count),
    '{{event_name}}': event.name,
    '{{event_location}}': event.location ?? '',
    '{{event_tagline}}': event.tagline ?? '',
  };
}
