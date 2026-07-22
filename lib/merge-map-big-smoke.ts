import { buildNyweVendorMergeMap } from '@/lib/merge-map-nywe';
import {
  packageSelectionsFromContract,
  pricingFromBigSmokeInput,
} from '@/lib/big-smoke-pricing';
import { contractHasExhibitorAddress } from '@/lib/nywe-billing';
import type { ContractWithTotals, Event } from '@/types/db';
import type { MergePlaceholderMode } from '@/lib/merge-map';

/**
 * Festival Sponsor address lines: prefer exhibitor mailing fields, else billing
 * collected on the Big Smoke new-contract form (so DocuSign does not need fill tabs).
 */
function bigSmokeAddressMergeOverlay(contract: ContractWithTotals): Record<string, string> {
  const line1 =
    contract.exhibitor_address_line1?.trim() || contract.billing_address_line1?.trim() || '';
  const line2 =
    contract.exhibitor_address_line2?.trim() || contract.billing_address_line2?.trim() || '';
  const city = contract.exhibitor_city?.trim() || contract.billing_city?.trim() || '';
  const state = contract.exhibitor_state?.trim() || contract.billing_state?.trim() || '';
  const zip = contract.exhibitor_zip?.trim() || contract.billing_zip?.trim() || '';
  const country =
    contract.exhibitor_country?.trim() || contract.billing_country?.trim() || '';

  if (!line1 && !city && !state && !zip && !contractHasExhibitorAddress(contract)) {
    return {};
  }

  return {
    '{{exhibitor_address_line1}}': line1,
    '{{exhibitor_address_line2}}': line2,
    '{{exhibitor_city}}': city,
    '{{exhibitor_state}}': state,
    '{{exhibitor_zip}}': zip,
    '{{exhibitor_country}}': country,
  };
}

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
  const priced = pricingFromBigSmokeInput({
    package_selections: packageSelectionsFromContract(contract),
    package_key: contract.package_key,
  });
  const actualFeeCents = (contract.booth_count ?? 0) * (contract.booth_rate_cents ?? 0);
  const feeCents =
    actualFeeCents > 0
      ? actualFeeCents
      : (contract.booth_subtotal_cents ?? priced?.fee_cents ?? contract.grand_total_cents);
  const fee =
    feeCents != null
      ? (feeCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (base['{{license_fee}}'] ?? '');

  const phone = (contract.exhibitor_telephone ?? '').trim();
  const email =
    (contract.event_contact_email ?? '').trim() ||
    (contract.billing_contact_email ?? '').trim() ||
    (contract.signer_1_email ?? '').trim();

  // Always print title / contact when we have them (NYWE map clears title).
  base['{{signer_1_title}}'] = (contract.signer_1_title ?? '').trim();
  base['{{exhibitor_telephone}}'] = phone;
  base['{{event_contact_email}}'] = email;

  // Prefer billing address from the form so Festival Sponsor prints real text.
  Object.assign(base, bigSmokeAddressMergeOverlay(contract));

  void mode;

  const firstPkg = priced?.package_selections[0]
    ? priced.package_selections[0]
    : null;

  return {
    ...base,
    '{{license_fee}}': fee,
    '{{license_fee_balance}}': fee,
    '{{package_fee}}': fee,
    '{{package_fee_balance}}': fee,
    '{{package_name}}': priced?.displayName ?? '',
    '{{package_booth_label}}': priced
      ? `${priced.booth_count} booth${priced.booth_count === 1 ? '' : 's'}`
      : '',
    '{{package_category}}': firstPkg
      ? priced!.displayName
      : '',
    '{{booth_count}}': String(priced?.booth_count ?? contract.booth_count),
    '{{event_name}}': event.name,
    '{{event_location}}': event.location ?? '',
    '{{event_tagline}}': event.tagline ?? '',
  };
}
