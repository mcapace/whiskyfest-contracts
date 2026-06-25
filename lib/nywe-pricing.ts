import { eventTemplateProfile } from '@/lib/contract-template-profile';
import type { Event } from '@/types/db';

/** Flat NYWE vendor license fee — not WhiskyFest per-booth pricing. */
export const NYWE_VENDOR_LICENSE_FEE_CENTS = 1_400_000;

export function isNyweVendorEvent(
  event?: Pick<Event, 'contract_template_profile'> | null,
): boolean {
  return event != null && eventTemplateProfile(event) === 'nywe_vendor';
}

export function nyweLicenseFeeCents(event?: Pick<Event, 'booth_rate_cents'> | null): number {
  return event?.booth_rate_cents ?? NYWE_VENDOR_LICENSE_FEE_CENTS;
}

/** NYWE licenses are always one flat fee (stored as booth_count=1 × license fee). */
export function normalizeNyweLicensePricing(
  event: Pick<Event, 'booth_rate_cents'>,
): { booth_count: 1; booth_rate_cents: number } {
  return { booth_count: 1, booth_rate_cents: nyweLicenseFeeCents(event) };
}

export function applyNyweLicensePricingIfNeeded(
  event: Pick<Event, 'contract_template_profile' | 'booth_rate_cents'>,
  pricing: { booth_count: number; booth_rate_cents: number },
): { booth_count: number; booth_rate_cents: number } {
  if (!isNyweVendorEvent(event)) return pricing;
  return normalizeNyweLicensePricing(event);
}
