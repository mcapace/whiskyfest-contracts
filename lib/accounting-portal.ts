import {
  PRODUCT_WHISKYFEST,
  PRODUCT_WINE_SPECTATOR,
  type ProductKey,
} from '@/lib/product-portal';
import type { ContractWithTotals, Event, InvoiceStatus } from '@/types/db';

export type AccountingPortalKey = typeof PRODUCT_WHISKYFEST | typeof PRODUCT_WINE_SPECTATOR;

export function accountingPortalFromPathname(pathname: string): AccountingPortalKey {
  if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) {
    return PRODUCT_WINE_SPECTATOR;
  }
  return PRODUCT_WHISKYFEST;
}

export function isNyweAccountingPath(pathname: string): boolean {
  return accountingPortalFromPathname(pathname) === PRODUCT_WINE_SPECTATOR;
}

export function accountingDashboardHref(productKey: ProductKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR ? '/accounting/nywe' : '/accounting';
}

export function accountingPortalLabel(productKey: AccountingPortalKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR ? 'NYWE' : 'WhiskyFest';
}

export function accountingPortalTitle(productKey: AccountingPortalKey): string {
  return productKey === PRODUCT_WINE_SPECTATOR
    ? 'NYWE Accounting'
    : 'WhiskyFest Accounting';
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
  if (raw === 'pending' || raw === 'invoice_sent' || raw === 'paid') return raw;
  return 'all';
}
