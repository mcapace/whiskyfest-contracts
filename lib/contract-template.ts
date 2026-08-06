import { BIG_SMOKE_TEMPLATE_DOC_ID } from '@/lib/big-smoke-template';
import { eventTemplateProfile } from '@/lib/contract-template-profile';
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
  const templateProfile = event ? eventTemplateProfile(event) : 'whiskyfest';

  if (isSponsorshipOnlyOrder(contract)) {
    const eventSponsorshipId = event?.google_sponsorship_template_doc_id?.trim();
    if (eventSponsorshipId) return eventSponsorshipId;
    const sponsorshipId = process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID?.trim();
    if (sponsorshipId) return sponsorshipId;
  }

  const eventBoothId = event?.google_template_doc_id?.trim();
  if (eventBoothId) return eventBoothId;

  // Big Smoke fallback: use BIG_SMOKE_TEMPLATE_DOC_ID env var or hardcoded Las Vegas template.
  // WARNING: Each Big Smoke event SHOULD have its own google_template_doc_id configured in the database
  // to avoid using the wrong template (e.g., Agua Caliente reception shouldn't use Las Vegas template).
  // This fallback exists for backwards compatibility but may produce incorrect results for non-Las Vegas events.
  if (templateProfile === 'big_smoke') {
    const fromEnv = process.env['BIG_SMOKE_TEMPLATE_DOC_ID']?.trim();
    const fallbackId = fromEnv || BIG_SMOKE_TEMPLATE_DOC_ID;
    console.warn(
      `[resolveContractTemplateDocId] Big Smoke event missing google_template_doc_id, ` +
      `falling back to ${fallbackId}. This may use the wrong template. ` +
      `Event should have its google_template_doc_id configured.`
    );
    return fallbackId;
  }

  // WhiskyFest / NYWE fallback
  const boothId = process.env.GOOGLE_TEMPLATE_DOC_ID?.trim();
  if (!boothId) {
    throw new Error('GOOGLE_TEMPLATE_DOC_ID is not set');
  }
  
  // Warn if we're using WhiskyFest template for what might be a Big Smoke contract
  if (event && !event.google_template_doc_id) {
    console.warn(
      `[resolveContractTemplateDocId] Event missing google_template_doc_id, ` +
      `falling back to GOOGLE_TEMPLATE_DOC_ID (${templateProfile} profile). ` +
      `Verify event.contract_template_profile is correct.`
    );
  }
  
  return boothId;
}

/** All configured template doc IDs (for Drive cleanup exclusions). */
export function configuredContractTemplateDocIds(extraDocIds: string[] = []): string[] {
  const ids = [
    process.env.GOOGLE_TEMPLATE_DOC_ID?.trim(),
    process.env.GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID?.trim(),
    process.env['BIG_SMOKE_TEMPLATE_DOC_ID']?.trim() || BIG_SMOKE_TEMPLATE_DOC_ID,
    ...extraDocIds,
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}
