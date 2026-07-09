import { appBaseUrlForProduct, workspaceLabelForProduct } from '@/lib/product-email';
import {
  PRODUCT_WINE_SPECTATOR,
  PRODUCT_WHISKYFEST,
  productKeyFromEvent,
  type ProductKey,
} from '@/lib/product-portal';
import { normalizeHost } from '@/lib/portal-host';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

export type ExhibitorSigningPortalContext = {
  productKey: ProductKey;
  workspaceLabel: string;
  portalOrigin: string;
  eventName: string;
};

/** Resolve NYWE vs WhiskyFest branding for an exhibitor signing link from the contract record. */
export async function loadExhibitorSigningPortalContext(
  contractId: string,
): Promise<ExhibitorSigningPortalContext | null> {
  const trimmedId = contractId.trim();
  if (!trimmedId) return null;

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('event_id')
    .eq('id', trimmedId)
    .maybeSingle<{ event_id: string }>();

  if (!contract?.event_id) return null;

  const { data: event } = await supabase
    .from('events')
    .select('product_key, name')
    .eq('id', contract.event_id)
    .maybeSingle<Pick<Event, 'product_key' | 'name'>>();

  if (!event) return null;

  const productKey = productKeyFromEvent(event);
  return {
    productKey,
    workspaceLabel: workspaceLabelForProduct(productKey),
    portalOrigin: appBaseUrlForProduct(productKey),
    eventName: event.name.trim(),
  };
}

/** When a signing link is opened on the wrong hostname, return the correct portal URL. */
export function exhibitorSigningCrossPortalRedirectUrl(
  currentHost: string | null | undefined,
  productKey: ProductKey,
  pathnameWithSearch: string,
): string | null {
  const path = pathnameWithSearch.startsWith('/') ? pathnameWithSearch : `/${pathnameWithSearch}`;
  const expectedOrigin = appBaseUrlForProduct(productKey).replace(/\/$/, '');
  let expectedHost: string;
  try {
    expectedHost = normalizeHost(new URL(expectedOrigin).host);
  } catch {
    return null;
  }

  const actualHost = normalizeHost(currentHost);
  if (!actualHost || actualHost === expectedHost) return null;

  return `${expectedOrigin}${path}`;
}

export function exhibitorSigningAccentClass(productKey: ProductKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR ? 'bg-[#6b3822]' : 'bg-neutral-900';
}

export function exhibitorSigningAccentHex(productKey: ProductKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR ? '#6b3822' : '#171717';
}

export function exhibitorSigningPortalKind(productKey: ProductKey): 'nywe' | 'whiskyfest' {
  return productKey === PRODUCT_WINE_SPECTATOR ? 'nywe' : 'whiskyfest';
}

export { PRODUCT_WINE_SPECTATOR, PRODUCT_WHISKYFEST };
