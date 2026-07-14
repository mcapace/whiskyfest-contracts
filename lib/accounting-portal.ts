import {
  PRODUCT_BIG_SMOKE,
  PRODUCT_WHISKYFEST,
  PRODUCT_WINE_SPECTATOR,
  type ProductKey,
} from '@/lib/product-portal';
import type { ContractWithTotals, Event, InvoiceStatus } from '@/types/db';
import type { PortalKind } from '@/lib/portal-host';

export type AccountingPortalKey =
  | typeof PRODUCT_WHISKYFEST
  | typeof PRODUCT_WINE_SPECTATOR
  | typeof PRODUCT_BIG_SMOKE;

export function accountingPortalFromPathname(
  pathname: string,
  portalKind?: PortalKind,
): AccountingPortalKey {
  if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) {
    return PRODUCT_WINE_SPECTATOR;
  }
  if (pathname === '/accounting/big-smoke' || pathname.startsWith('/accounting/big-smoke/')) {
    return PRODUCT_BIG_SMOKE;
  }
  if (portalKind === 'nywe' && (pathname === '/accounting' || pathname.startsWith('/accounting/'))) {
    return PRODUCT_WINE_SPECTATOR;
  }
  if (
    portalKind === 'big_smoke' &&
    (pathname === '/accounting' || pathname.startsWith('/accounting/'))
  ) {
    return PRODUCT_BIG_SMOKE;
  }
  return PRODUCT_WHISKYFEST;
}

export function isNyweAccountingPath(pathname: string, portalKind?: PortalKind): boolean {
  return accountingPortalFromPathname(pathname, portalKind) === PRODUCT_WINE_SPECTATOR;
}

export function isBigSmokeAccountingPath(pathname: string, portalKind?: PortalKind): boolean {
  return accountingPortalFromPathname(pathname, portalKind) === PRODUCT_BIG_SMOKE;
}

export function accountingDashboardHref(productKey: ProductKey, portalKind?: PortalKind): string {
  if (productKey === PRODUCT_WINE_SPECTATOR) {
    return portalKind === 'nywe' ? '/accounting' : '/accounting/nywe';
  }
  if (productKey === PRODUCT_BIG_SMOKE) {
    return portalKind === 'big_smoke' ? '/accounting' : '/accounting/big-smoke';
  }
  return '/accounting';
}

export function accountingPortalLabel(productKey: AccountingPortalKey): string {
  if (productKey === PRODUCT_WINE_SPECTATOR) return 'NYWE';
  if (productKey === PRODUCT_BIG_SMOKE) return 'Big Smoke';
  return 'WhiskyFest';
}

export function accountingPortalTitle(productKey: AccountingPortalKey): string {
  if (productKey === PRODUCT_WINE_SPECTATOR) return 'NYWE Accounting';
  if (productKey === PRODUCT_BIG_SMOKE) return 'Big Smoke Accounting';
  return 'WhiskyFest Accounting';
}

export function eventIdsForProduct(events: Event[], productKey: AccountingPortalKey): Set<string> {
  return new Set(events.filter((e) => e.product_key === productKey).map((e) => e.id));
}

export function filterContractsByAccountingPortal(
  contracts: ContractWithTotals[],
  events: Event[],
  productKey: AccountingPortalKey,
): ContractWithTotals[] {
  const ids = eventIdsForProduct(events, productKey);
  return contracts.filter((c) => ids.has(c.event_id));
}

export function parseInvoiceFilter(raw: string | undefined): InvoiceStatus | 'all' {
  if (
    raw === 'pending' ||
    raw === 'invoice_sent' ||
    raw === 'paid' ||
    raw === 'not_invoiced' ||
    raw === 'invoice_voided'
  ) {
    return raw;
  }
  return 'all';
}
