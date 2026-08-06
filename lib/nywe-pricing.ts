import { eventTemplateProfile } from '@/lib/contract-template-profile';
import type { Event } from '@/types/db';

/** Default NYWE vendor license fee — not WhiskyFest per-booth pricing. */
export const NYWE_VENDOR_LICENSE_FEE_CENTS = 1_400_000;

/**
 * Flat package-fee events (NYWE vendor license + Big Smoke packages).
 * Not WhiskyFest per-booth / line-item pricing.
 */
export function isPackageFeeEvent(
  event?: Pick<Event, 'contract_template_profile'> | null,
): boolean {
  if (!event) return false;
  const p = eventTemplateProfile(event);
  return p === 'nywe_vendor' || p === 'big_smoke';
}

/** Flat NYWE vendor license only (not Big Smoke multi-package). */
export function isNyweVendorOnlyEvent(
  event?: Pick<Event, 'contract_template_profile'> | null,
): boolean {
  return event != null && eventTemplateProfile(event) === 'nywe_vendor';
}

/** @deprecated Prefer isPackageFeeEvent — includes Big Smoke. */
export function isNyweVendorEvent(
  event?: Pick<Event, 'contract_template_profile'> | null,
): boolean {
  return isPackageFeeEvent(event);
}

export function nyweLicenseFeeCents(event?: Pick<Event, 'booth_rate_cents'> | null): number {
  return event?.booth_rate_cents ?? NYWE_VENDOR_LICENSE_FEE_CENTS;
}

/** Package / license fees are always one flat fee (stored as booth_count=1 × fee). */
export function normalizeNyweLicensePricing(
  event: Pick<Event, 'booth_rate_cents'>,
): { booth_count: 1; booth_rate_cents: number } {
  return { booth_count: 1, booth_rate_cents: nyweLicenseFeeCents(event) };
}

export function applyNyweLicensePricingIfNeeded(
  event: Pick<Event, 'contract_template_profile' | 'booth_rate_cents'>,
  pricing: { booth_count: number; booth_rate_cents: number },
  options?: { orderType?: string | null },
): { booth_count: number; booth_rate_cents: number } {
  // Big Smoke: form supplies package fee + booth count — do not flatten to NYWE single-booth.
  if (eventTemplateProfile(event) === 'big_smoke') {
    return pricing;
  }
  // NYWE sponsorship-only: booth 0 / rate 0 + line items (WhiskyFest pattern).
  if (options?.orderType === 'sponsorship_only') {
    return { booth_count: 0, booth_rate_cents: 0 };
  }
  if (!isNyweVendorOnlyEvent(event)) return pricing;
  return normalizeNyweLicensePricing(event);
}

/** Package-fee agreements typically omit exhibitor job title on the contract. */
export function signerTitleForContract(
  event: Pick<Event, 'contract_template_profile'> | null | undefined,
  title: string | null | undefined,
): string | null {
  if (isPackageFeeEvent(event)) return null;
  const trimmed = title?.trim();
  return trimmed || null;
}
