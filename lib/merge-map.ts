import { formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import {
  calculateDiscountCents,
  calculateListSubtotalCents,
  isDiscountedRate,
  STANDARD_BOOTH_RATE_CENTS,
} from '@/lib/contracts';
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
 * Soft line break inside merged table cells when exporting Google Docs → PDF.
 * `\n` is sometimes unreliable in replaceAllText; `\u000b` (vertical tab) is preferred by Docs API.
 */
const GOOGLE_DOCS_CELL_LINE_BREAK = '\u000b';

function formatMoney(cents: number): string {
  return formatCurrency(cents);
}

/** Google Doc tokens often omit the leading `$` (matches `{{grand_total}}`). */
function moneyTokenNoDollar(cents: number): string {
  return formatCurrency(cents).replace('$', '').trim();
}

/**
 * Single-order-row pricing copy for the CONTRACT ORDER table (tokens may embed line breaks).
 */
export function buildPricingComposition(contract: ContractWithTotals): {
  pricing_description: string;
  pricing_qty: string;
  pricing_amount: string;
} {
  const lb = GOOGLE_DOCS_CELL_LINE_BREAK;
  const boothCount = contract.booth_count;
  const isDiscounted = isDiscountedRate(contract.booth_rate_cents);

  if (!isDiscounted) {
    return {
      pricing_description: `Booths @ ${formatMoney(STANDARD_BOOTH_RATE_CENTS)}/booth`,
      pricing_qty: String(boothCount),
      pricing_amount: formatMoney(boothCount * contract.booth_rate_cents),
    };
  }

  const listSubtotalCents = calculateListSubtotalCents(boothCount);
  const discountCents = calculateDiscountCents(boothCount, contract.booth_rate_cents);

  return {
    pricing_description: `Booths @ ${formatMoney(STANDARD_BOOTH_RATE_CENTS)}/booth (list)${lb}Negotiated discount`,
    pricing_qty: `${boothCount}${lb}`,
    pricing_amount: `${formatMoney(listSubtotalCents)}${lb}-${formatMoney(discountCents)}`,
  };
}

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

  const pricing = buildPricingComposition(contract);

  const discounted = isDiscountedRate(contract.booth_rate_cents);
  const listBoothRateDisplay = formatCurrency(STANDARD_BOOTH_RATE_CENTS);
  let discountDescription = '';
  let discountAmountDisplay = '';
  let listSubtotalDisplay = '';
  if (discounted) {
    discountDescription = 'Negotiated discount';
    const discountCents = calculateDiscountCents(contract.booth_count, contract.booth_rate_cents);
    discountAmountDisplay = `-${formatCurrency(discountCents)}`;
    listSubtotalDisplay = formatCurrency(calculateListSubtotalCents(contract.booth_count));
  }

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
    '{{booth_total}}': formatCurrency(contract.booth_subtotal_cents).replace('$', '').trim(),
    '{{pricing_description}}': pricing.pricing_description,
    '{{pricing_qty}}': pricing.pricing_qty,
    '{{pricing_amount}}': pricing.pricing_amount,
    '{{additional_brand_count}}': String(contract.additional_brand_count),
    '{{additional_brand_fee}}': formatCurrency(contract.additional_brand_fee_cents).replace('$', '').trim(),
    '{{grand_total}}': moneyTokenNoDollar(contract.grand_total_cents),
    // Optional legacy tokens; line items render as inserted table rows, not paragraph prose.
    '{{TOTAL_AMOUNT}}': moneyTokenNoDollar(contract.grand_total_cents),
    '{{LINE_ITEMS_SECTION}}': '',
    '{{list_booth_rate}}': listBoothRateDisplay,
    '{{discount_description}}': discountDescription,
    '{{discount_amount}}': discountAmountDisplay,
    '{{list_subtotal}}': listSubtotalDisplay,
    '{{signer_1_name}}': contract.signer_1_name ?? '',
    '{{signer_1_title}}': contract.signer_1_title ?? '',
    '{{shanken_signatory_name}}': event.shanken_signatory_name,
    '{{shanken_signatory_title}}': event.shanken_signatory_title,
    '{{shanken_signatory_email}}': event.shanken_signatory_email,
    ...anchors,
  };
}
