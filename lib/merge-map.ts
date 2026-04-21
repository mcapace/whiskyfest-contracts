import { formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { formatCurrency } from '@/lib/utils';
import { formatEventDateForMerge, getAgreementDatePartsInDisplayZone } from '@/lib/datetime';
import type { ContractWithTotals, Event } from '@/types/db';

/** Draft PDFs use blank lines; DocuSign send uses literal anchor strings in the PDF. */
export type MergePlaceholderMode = 'draft' | 'docusign';

const DRAFT_SIG_LINE = '_______________________________';
const DRAFT_DATE_LINE = '________________';

/** DocuSign anchor strings — must match tabs in lib/docusign.ts */
export const DOCUSIGN_ANCHORS = {
  sig1: '\\s1\\',
  date1: '\\d1\\',
  sig2: '\\s2\\',
  date2: '\\d2\\',
} as const;

/**
 * Build Google Docs merge tokens for the contract template.
 * Phase 1 (draft): anchors render as blank lines for humans.
 * Phase 2 (docusign): same tokens become \\s1\\, \\d1\\, etc. for tab placement.
 */
export function buildContractMergeMap(
  contract: ContractWithTotals,
  event: Event,
  mode: MergePlaceholderMode,
): Record<string, string> {
  const agreement = getAgreementDatePartsInDisplayZone();

  const anchors =
    mode === 'draft'
      ? {
          '{{sig_anchor_1}}': DRAFT_SIG_LINE,
          '{{date_anchor_1}}': DRAFT_DATE_LINE,
          '{{sig_anchor_2}}': DRAFT_SIG_LINE,
          '{{date_anchor_2}}': DRAFT_DATE_LINE,
        }
      : {
          '{{sig_anchor_1}}': DOCUSIGN_ANCHORS.sig1,
          '{{date_anchor_1}}': DOCUSIGN_ANCHORS.date1,
          '{{sig_anchor_2}}': DOCUSIGN_ANCHORS.sig2,
          '{{date_anchor_2}}': DOCUSIGN_ANCHORS.date2,
        };

  return {
    '{{event_year}}': String(event.year),
    '{{event_tagline}}': event.tagline ?? '',
    '{{event_location}}': event.location ?? '',
    '{{event_date}}': formatEventDateForMerge(event.event_date),
    '{{event_venue}}': event.venue ?? '',
    '{{agreement_day}}': agreement.day,
    '{{agreement_month}}': agreement.monthName,
    '{{agreement_year}}': agreement.year,
    '{{exhibitor_legal_name}}': contract.exhibitor_legal_name,
    '{{exhibitor_company_name}}': contract.exhibitor_company_name,
    '{{exhibitor_address}}': formatExhibitorAddressBlock(contract),
    '{{exhibitor_telephone}}': contract.exhibitor_telephone ?? '',
    '{{brands_poured}}': contract.brands_poured ?? '',
    '{{booth_count}}': String(contract.booth_count),
    '{{booth_rate}}': formatCurrency(contract.booth_rate_cents).replace('$', '').trim(),
    '{{booth_subtotal}}': formatCurrency(contract.booth_subtotal_cents).replace('$', '').trim(),
    '{{additional_brand_count}}': String(contract.additional_brand_count),
    '{{additional_brand_fee}}': formatCurrency(contract.additional_brand_fee_cents).replace('$', '').trim(),
    '{{grand_total}}': formatCurrency(contract.grand_total_cents).replace('$', '').trim(),
    '{{signer_1_name}}': contract.signer_1_name ?? '',
    '{{signer_1_title}}': contract.signer_1_title ?? '',
    '{{shanken_signatory_name}}': event.shanken_signatory_name,
    '{{shanken_signatory_title}}': event.shanken_signatory_title,
    '{{shanken_signatory_email}}': event.shanken_signatory_email,
    ...anchors,
  };
}
