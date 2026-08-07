import { BIG_SMOKE_TEMPLATE_DOC_ID } from '@/lib/big-smoke-template';
import { eventTemplateProfile, type ContractTemplateProfile } from '@/lib/contract-template-profile';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import type { Event } from '@/types/db';

type ContractForTemplate = {
  order_type?: string | null;
  booth_count?: number | null;
};

type EventForTemplate = Pick<
  Event,
  'google_template_doc_id' | 'google_sponsorship_template_doc_id' | 'contract_template_profile' | 'name'
>;

function requireEnvDocId(envKey: string): string {
  const id = process.env[envKey]?.trim();
  if (!id) {
    throw new Error(`${envKey} is not set`);
  }
  return id;
}

function bigSmokeBoothFallbackDocId(): string {
  return process.env['BIG_SMOKE_TEMPLATE_DOC_ID']?.trim() || BIG_SMOKE_TEMPLATE_DOC_ID;
}

/**
 * Resolve sponsorship template without ever crossing portals.
 * WhiskyFest env sponsorship is WhiskyFest-only.
 */
function resolveSponsorshipTemplateDocId(
  event: EventForTemplate | null | undefined,
  profile: ContractTemplateProfile,
): string {
  const eventSponsorshipId = event?.google_sponsorship_template_doc_id?.trim();
  if (eventSponsorshipId) return eventSponsorshipId;

  // Same-portal booth/package template is safer than a WhiskyFest sponsorship env fallback.
  const eventBoothId = event?.google_template_doc_id?.trim();
  if (eventBoothId) return eventBoothId;

  if (profile === 'whiskyfest') {
    return requireEnvDocId('GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID');
  }

  if (profile === 'big_smoke') {
    const fallbackId = bigSmokeBoothFallbackDocId();
    console.warn(
      `[resolveContractTemplateDocId] Big Smoke sponsorship missing google_sponsorship_template_doc_id ` +
        `(event="${event?.name ?? 'unknown'}"); using Big Smoke booth template ${fallbackId}.`,
    );
    return fallbackId;
  }

  // NYWE: never fall back to WhiskyFest sponsorship env.
  throw new Error(
    `NYWE sponsorship template is not configured on the event` +
      `${event?.name ? ` "${event.name}"` : ''}. ` +
      `Set events.google_sponsorship_template_doc_id.`,
  );
}

/**
 * Resolve booth / package / license template without ever crossing portals.
 */
function resolveBoothTemplateDocId(
  event: EventForTemplate | null | undefined,
  profile: ContractTemplateProfile,
): string {
  const eventBoothId = event?.google_template_doc_id?.trim();
  if (eventBoothId) return eventBoothId;

  if (profile === 'big_smoke') {
    const fallbackId = bigSmokeBoothFallbackDocId();
    console.warn(
      `[resolveContractTemplateDocId] Big Smoke event missing google_template_doc_id ` +
        `(event="${event?.name ?? 'unknown'}"); falling back to ${fallbackId}. ` +
        `Configure events.google_template_doc_id for this event.`,
    );
    return fallbackId;
  }

  if (profile === 'nywe_vendor') {
    throw new Error(
      `NYWE vendor license template is not configured on the event` +
        `${event?.name ? ` "${event.name}"` : ''}. ` +
        `Set events.google_template_doc_id.`,
    );
  }

  return requireEnvDocId('GOOGLE_TEMPLATE_DOC_ID');
}

/**
 * Google Doc used to render draft + DocuSign PDFs.
 * Per-event doc IDs on the event row take precedence over env fallbacks.
 *
 * Portal isolation rule: WhiskyFest env templates are NEVER used for Big Smoke or NYWE.
 */
export function resolveContractTemplateDocId(
  contract: ContractForTemplate,
  event?: EventForTemplate | null,
): string {
  const profile = event ? eventTemplateProfile(event) : 'whiskyfest';

  if (isSponsorshipOnlyOrder(contract)) {
    return resolveSponsorshipTemplateDocId(event, profile);
  }

  return resolveBoothTemplateDocId(event, profile);
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
