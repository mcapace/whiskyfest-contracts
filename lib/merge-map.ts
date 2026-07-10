import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { isNoChargeBoothContract } from '@/lib/no-charge-booth';
import { formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { exhibitorFieldMergeTokens } from '@/lib/exhibitor-docusign-fields';
import {
  calculateDiscountCents,
  calculateListSubtotalCents,
  isDiscountedRate,
  STANDARD_BOOTH_RATE_CENTS,
} from '@/lib/contracts';
import { formatCurrency } from '@/lib/utils';
import { formatEventDateForMerge, getAgreementDatePartsInDisplayZone } from '@/lib/datetime';
import { eventTemplateProfile } from '@/lib/contract-template-profile';
import { buildNyweVendorMergeMap } from '@/lib/merge-map-nywe';
import { usesSingleSignerEnvelope } from '@/lib/single-signer-envelope';
import { formatBoothBrandsBlock } from '@/lib/contract-booth-brands';
import type { ContractBoothBrand, ContractWithTotals, Event } from '@/types/db';

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
export function buildPricingComposition(
  contract: ContractWithTotals,
  event?: Event,
): {
  pricing_description: string;
  pricing_qty: string;
  pricing_amount: string;
} {
  if (isSponsorshipOnlyOrder(contract)) {
    return { pricing_description: '', pricing_qty: '', pricing_amount: '' };
  }

  const lb = GOOGLE_DOCS_CELL_LINE_BREAK;
  const boothCount = contract.booth_count;
  const listRateCents = event ? event.booth_rate_cents : STANDARD_BOOTH_RATE_CENTS;

  if (isNoChargeBoothContract(contract)) {
    return {
      pricing_description: `Complimentary booth (no charge)`,
      pricing_qty: String(boothCount),
      pricing_amount: formatMoney(0),
    };
  }

  const isDiscounted = isDiscountedRate(contract.booth_rate_cents, event);

  if (!isDiscounted) {
    return {
      pricing_description: `Booths @ ${formatMoney(listRateCents)}/booth`,
      pricing_qty: String(boothCount),
      pricing_amount: formatMoney(boothCount * contract.booth_rate_cents),
    };
  }

  const listSubtotalCents = calculateListSubtotalCents(boothCount, event);
  const discountCents = calculateDiscountCents(boothCount, contract.booth_rate_cents, event);

  return {
    pricing_description: `Booths @ ${formatMoney(listRateCents)}/booth (list)${lb}Negotiated discount`,
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
  boothBrands?: ContractBoothBrand[],
): Record<string, string> {
  if (eventTemplateProfile(event) === 'nywe_vendor') {
    return buildNyweVendorMergeMap(contract, event, mode);
  }

  const agreement = getAgreementDatePartsInDisplayZone();

  const pricing = buildPricingComposition(contract, event);

  const discounted = !isSponsorshipOnlyOrder(contract) && isDiscountedRate(contract.booth_rate_cents, event);
  const listBoothRateDisplay = formatCurrency(event.booth_rate_cents);
  let discountDescription = '';
  let discountAmountDisplay = '';
  let listSubtotalDisplay = '';
  if (discounted) {
    discountDescription = 'Negotiated discount';
    const discountCents = calculateDiscountCents(contract.booth_count, contract.booth_rate_cents, event);
    discountAmountDisplay = `-${formatCurrency(discountCents)}`;
    listSubtotalDisplay = formatCurrency(calculateListSubtotalCents(contract.booth_count, event));
  }

  const boothBlock = formatBoothBrandsBlock(boothBrands ?? []);
  const singleSigner = usesSingleSignerEnvelope(event);
  const shankenSigLine = `/s/ ${event.shanken_signatory_name}`.trim();
  const shankenDateLine = `${agreement.monthName} ${agreement.day}, ${agreement.year}`;

  const anchors =
    mode === 'draft'
      ? {
          '{{sig_anchor_1}}': DRAFT_SIG_LINE,
          '{{date_anchor_1}}': DRAFT_DATE_LINE,
          '{{sig_anchor_2}}': DRAFT_SIG_LINE,
          '{{date_anchor_2}}': DRAFT_DATE_LINE,
        }
      : singleSigner
        ? {
            '{{sig_anchor_1}}': DOCUSIGN_ANCHORS.sig1,
            '{{date_anchor_1}}': DOCUSIGN_ANCHORS.date1,
            '{{sig_anchor_2}}': shankenSigLine,
            '{{date_anchor_2}}': shankenDateLine,
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
    '{{brands_poured}}': boothBlock.length > 0 ? boothBlock : (contract.brands_poured ?? ''),
    '{{booth_brands_block}}': boothBlock,
    '{{booth_brands_detail}}': boothBlock,
    '{{booth_count}}': isSponsorshipOnlyOrder(contract) ? '' : String(contract.booth_count),
    '{{booth_rate}}': isSponsorshipOnlyOrder(contract)
      ? ''
      : formatCurrency(contract.booth_rate_cents).replace('$', '').trim(),
    '{{booth_subtotal}}': isSponsorshipOnlyOrder(contract)
      ? ''
      : formatCurrency(contract.booth_subtotal_cents).replace('$', '').trim(),
    '{{booth_total}}': isSponsorshipOnlyOrder(contract)
      ? ''
      : formatCurrency(contract.booth_subtotal_cents).replace('$', '').trim(),
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
    '{{exhibitor_notes}}': (contract.exhibitor_notes ?? '').trim(),
    '{{revision_amendments}}': (contract.revision_amendments ?? '').trim(),
    ...anchors,
    ...exhibitorFieldMergeTokens(mode),
  };
}
