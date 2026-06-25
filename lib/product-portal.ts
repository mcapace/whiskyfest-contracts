import type { ContractWithTotals, Event } from '@/types/db';

export const PRODUCT_WHISKYFEST = 'whiskyfest';
export const PRODUCT_WINE_SPECTATOR = 'wine_spectator';

export type ProductKey = typeof PRODUCT_WHISKYFEST | typeof PRODUCT_WINE_SPECTATOR | string;

export function productFromPathname(pathname: string): ProductKey {
  if (pathname === '/wine-spectator' || pathname.startsWith('/wine-spectator/')) {
    return PRODUCT_WINE_SPECTATOR;
  }
  return PRODUCT_WHISKYFEST;
}

export function isWineSpectatorPath(pathname: string): boolean {
  return productFromPathname(pathname) === PRODUCT_WINE_SPECTATOR;
}

export function isAccountingPath(pathname: string): boolean {
  return pathname === '/accounting' || pathname.startsWith('/accounting/');
}

export function isNyweAccountingPathname(pathname: string): boolean {
  return pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/');
}

export function accountingDashboardHref(productKey: ProductKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR ? '/accounting/nywe' : '/accounting';
}

export function productBasePath(productKey: ProductKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR ? '/wine-spectator' : '';
}

export function productDisplayLabel(productKey: ProductKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR ? 'Wine Spectator' : 'WhiskyFest';
}

/** Sticky header label when no page-specific title is set. */
export function portalTopbarLabel(pathname: string): string {
  if (isWineSpectatorPath(pathname)) return 'Wine Spectator · NYWE';
  if (isNyweAccountingPathname(pathname)) return 'Accounting · NYWE';
  if (isAccountingPath(pathname)) return 'Accounting · WhiskyFest';
  return 'WhiskyFest · Contracts';
}

export function portalDocumentTitle(pathname: string): string {
  if (isWineSpectatorPath(pathname)) return 'NYWE Contracts | Wine Spectator';
  if (isNyweAccountingPathname(pathname)) return 'NYWE Accounting | M. Shanken';
  if (isAccountingPath(pathname)) return 'WhiskyFest Accounting | M. Shanken';
  return 'WhiskyFest Contracts';
}

export function scopeEventsByProduct(events: Event[], productKey: ProductKey): Event[] {
  return events.filter((e) => e.product_key === productKey);
}

export function eventIdsForProduct(events: Event[], productKey: ProductKey): string[] {
  return scopeEventsByProduct(events, productKey).map((e) => e.id);
}

export function scopeContractsByProduct(
  contracts: ContractWithTotals[],
  allEvents: Event[],
  productKey: ProductKey,
): ContractWithTotals[] {
  const eventIds = new Set(
    allEvents.filter((e) => e.product_key === productKey).map((e) => e.id),
  );
  const scoped = contracts.filter((c) => eventIds.has(c.event_id));
  if (productKey === PRODUCT_WINE_SPECTATOR) {
    return filterNywePortalContracts(scoped);
  }
  return scoped;
}

/**
 * NYWE portal shows roster-linked licenses and drafts created in-app — not legacy
 * WhiskyFest PDF imports that were accidentally attached to the wine_spectator event.
 */
export function filterNywePortalContracts(contracts: ContractWithTotals[]): ContractWithTotals[] {
  return contracts.filter((c) => {
    if (c.source_sheet_id) return true;
    if (c.status === 'imported' || c.imported_at) return false;
    return true;
  });
}

export function contractListHref(productKey: ProductKey): string {
  return `${productBasePath(productKey)}/contracts`;
}

export function contractDetailHref(productKey: ProductKey, contractId: string): string {
  return `${productBasePath(productKey)}/contracts/${contractId}`;
}

export function contractNewHref(productKey: ProductKey, deal?: string): string {
  const base = `${productBasePath(productKey)}/contracts/new`;
  return deal ? `${base}?deal=${deal}` : base;
}

export function dashboardHref(productKey: ProductKey): string {
  return productBasePath(productKey) || '/';
}

export function productKeyFromEvent(event: Pick<Event, 'product_key'> | null | undefined): ProductKey {
  return event?.product_key === PRODUCT_WINE_SPECTATOR ? PRODUCT_WINE_SPECTATOR : PRODUCT_WHISKYFEST;
}
