import {
  PRODUCT_WINE_SPECTATOR,
  contractDetailHref,
  productKeyFromEvent,
  type ProductKey,
} from '@/lib/product-portal';
import { nywePortalOrigin, nywePublicPath, whiskyfestPortalOrigin } from '@/lib/portal-host';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

export type EventEmailContext = Pick<Event, 'product_key' | 'name'>;

export function appBaseUrl(): string {
  return whiskyfestPortalOrigin();
}

export function appBaseUrlForProduct(productKey: ProductKey | null | undefined): string {
  if (productKey === PRODUCT_WINE_SPECTATOR) return nywePortalOrigin();
  return whiskyfestPortalOrigin();
}

export function isWineSpectatorProduct(productKey: string | null | undefined): boolean {
  return productKey === PRODUCT_WINE_SPECTATOR;
}

/** SendGrid verified from-address + display name per product portal. */
export function sendGridFromForProduct(productKey: ProductKey | null | undefined): {
  email: string;
  name: string;
} {
  if (isWineSpectatorProduct(productKey)) {
    return {
      email:
        process.env['WINE_SPECTATOR_FROM_EMAIL']?.trim() ||
        process.env['NYWE_FROM_EMAIL']?.trim() ||
        'nywecontracts@winespectator.com',
      name:
        process.env['WINE_SPECTATOR_FROM_NAME']?.trim() ||
        process.env['NYWE_FROM_NAME']?.trim() ||
        'NYWE Contracts',
    };
  }

  return {
    email:
      process.env['WHISKYFEST_FROM_EMAIL']?.trim() ||
      process.env['DISCOUNT_ALERT_FROM_EMAIL']?.trim() ||
      'wfcontracts@whiskyadvocate.com',
    name: process.env['WHISKYFEST_FROM_NAME']?.trim() || 'WhiskyFest Contracts',
  };
}

export function sendGridFromForEvent(event: EventEmailContext | null | undefined): {
  email: string;
  name: string;
} {
  return sendGridFromForProduct(productKeyFromEvent(event));
}

/** In-app workspace label used in email footers and CTAs. */
export function workspaceLabelForProduct(productKey: ProductKey | null | undefined): string {
  if (isWineSpectatorProduct(productKey)) {
    return process.env['WINE_SPECTATOR_WORKSPACE_LABEL']?.trim() || 'Wine Spectator Contracts';
  }
  return 'WhiskyFest Contracts';
}

export function workspaceLabelForEvent(event: EventEmailContext | null | undefined): string {
  return workspaceLabelForProduct(productKeyFromEvent(event));
}

export function appContractUrl(contractId: string, event: EventEmailContext | null | undefined): string {
  const productKey = productKeyFromEvent(event);
  const href = contractDetailHref(productKey, contractId);
  const publicHref = productKey === PRODUCT_WINE_SPECTATOR ? nywePublicPath(href) : href;
  return `${appBaseUrlForProduct(productKey)}${publicHref}`;
}

export function accountingContractUrl(contractId: string, productKey: ProductKey | null | undefined): string {
  return `${appBaseUrlForProduct(productKey)}/accounting/${contractId}`;
}

/** Optional DocuSign brand — controls exhibitor-facing signing email from-name/logo. */
export function docusignBrandIdForEvent(event: EventEmailContext | null | undefined): string | undefined {
  const productKey = productKeyFromEvent(event);
  if (isWineSpectatorProduct(productKey)) {
    return (
      process.env['DOCUSIGN_BRAND_ID_WINE_SPECTATOR']?.trim() ||
      process.env['DOCUSIGN_BRAND_ID_NYWE']?.trim() ||
      undefined
    );
  }
  return process.env['DOCUSIGN_BRAND_ID_WHISKYFEST']?.trim() || undefined;
}

export async function loadEventEmailContext(
  eventId: string | null | undefined,
): Promise<EventEmailContext | null> {
  if (!eventId) return null;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('events')
    .select('product_key, name')
    .eq('id', eventId)
    .maybeSingle<EventEmailContext>();
  return data ?? null;
}

export async function eventEmailContextForContract(
  contract: { event_id?: string | null },
  event?: EventEmailContext | null,
): Promise<EventEmailContext | null> {
  if (event?.product_key) return event;
  return loadEventEmailContext(contract.event_id);
}
