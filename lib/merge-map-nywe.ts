import { DOCUSIGN_ANCHORS } from '@/lib/merge-map';
import { formatCurrency } from '@/lib/utils';
import { getAgreementDatePartsInDisplayZone } from '@/lib/datetime';
import { formatEventDateForDisplayOrMerge } from '@/lib/event-schedule';
import type { ContractWithTotals, Event } from '@/types/db';
import type { MergePlaceholderMode } from '@/lib/merge-map';

const DRAFT_SIG_LINE = '______________________________';
const DRAFT_DATE_LINE = '________________';

function moneyNoDollar(cents: number): string {
  return formatCurrency(cents).replace('$', '').trim();
}

/** Vendor license agreement merge tokens for NYWE booth deals. */
export function buildNyweVendorMergeMap(
  contract: ContractWithTotals,
  event: Event,
  mode: MergePlaceholderMode,
): Record<string, string> {
  const agreement = getAgreementDatePartsInDisplayZone();
  const licenseFeeCents = contract.grand_total_cents;

  const anchors =
    mode === 'draft'
      ? {
          '{{sig_anchor_1}}': DRAFT_SIG_LINE,
          '{{sig_anchor_2}}': DRAFT_SIG_LINE,
          '{{date_anchor_1}}': DRAFT_DATE_LINE,
          '{{date_anchor_2}}': DRAFT_DATE_LINE,
        }
      : {
          '{{sig_anchor_1}}': DOCUSIGN_ANCHORS.sig1,
          '{{sig_anchor_2}}': DOCUSIGN_ANCHORS.sig2,
          '{{date_anchor_1}}': DOCUSIGN_ANCHORS.date1,
          '{{date_anchor_2}}': DOCUSIGN_ANCHORS.date2,
        };

  return {
    '{{event_year}}': String(event.year),
    '{{event_date}}': formatEventDateForDisplayOrMerge(event),
    '{{event_venue}}': event.venue ?? '',
    '{{agreement_day}}': agreement.day,
    '{{agreement_month}}': agreement.monthName,
    '{{agreement_year}}': agreement.year,
    '{{exhibitor_legal_name}}': contract.exhibitor_legal_name,
    '{{exhibitor_company_name}}': contract.exhibitor_company_name,
    '{{license_fee}}': moneyNoDollar(licenseFeeCents),
    '{{license_fee_balance}}': moneyNoDollar(licenseFeeCents),
    '{{booth_count}}': String(contract.booth_count),
    '{{signer_1_name}}': contract.signer_1_name ?? '',
    '{{signer_1_title}}': contract.signer_1_title ?? '',
    '{{shanken_signatory_name}}': event.shanken_signatory_name,
    '{{shanken_signatory_title}}': event.shanken_signatory_title,
    '{{shanken_signatory_email}}': event.shanken_signatory_email,
    ...anchors,
  };
}
