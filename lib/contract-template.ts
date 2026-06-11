import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import type { Event } from '@/types/db';

type ContractForTemplate = {
  order_type?: string | null;
  booth_count?: number | null;
};

type EventForTemplate = Pick<
  Event,
  'google_template_doc_id' | 'google_sponsorship_template_doc_id' | 'contract_template_profile'
>;

/**
 * Google Doc used to render draft + DocuSign PDFs.
 * Per-event doc IDs on the event row take precedence over env fallbacks.
 */
export function resolveContractTemplateDocId(
  contract: ContractForTemplate,
  event?: EventForTemplate | null,
): string {
  if (isSponsorshipOnlyOrder(contract)) {
    const eventSponsorshipId = event?.google_sponsorship_template_doc_id?.trim();
    if (eventSponsorshipId) return eventSponsorshipId;
    const sponsorshipId = process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID?.trim();
    if (sponsorshipId) return sponsorshipId;
  }

  const eventBoothId = event?.google_template_doc_id?.trim();
  if (eventBoothId) return eventBoothId;

  const boothId = process.env.GOOGLE_TEMPLATE_DOC_ID?.trim();
  if (!boothId) {
    throw new Error('GOOGLE_TEMPLATE_DOC_ID is not set');
  }
  return boothId;
}

/** All configured template doc IDs (for Drive cleanup exclusions). */
export function configuredContractTemplateDocIds(extraDocIds: string[] = []): string[] {
  const ids = [
    process.env.GOOGLE_TEMPLATE_DOC_ID?.trim(),
    process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID?.trim(),
    ...extraDocIds,
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}
