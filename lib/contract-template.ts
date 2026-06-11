import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';

type ContractForTemplate = {
  order_type?: string | null;
  booth_count?: number | null;
};

/**
 * Google Doc used to render draft + DocuSign PDFs.
 * Booth deals → GOOGLE_TEMPLATE_DOC_ID
 * Sponsorship-only → GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID (falls back to booth template if unset)
 */
export function resolveContractTemplateDocId(contract: ContractForTemplate): string {
  if (isSponsorshipOnlyOrder(contract)) {
    const sponsorshipId = process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID?.trim();
    if (sponsorshipId) return sponsorshipId;
  }
  const boothId = process.env.GOOGLE_TEMPLATE_DOC_ID?.trim();
  if (!boothId) {
    throw new Error('GOOGLE_TEMPLATE_DOC_ID is not set');
  }
  return boothId;
}

/** All configured template doc IDs (for Drive cleanup exclusions). */
export function configuredContractTemplateDocIds(): string[] {
  const ids = [
    process.env.GOOGLE_TEMPLATE_DOC_ID?.trim(),
    process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID?.trim(),
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}
