import { AccountingDashboardView } from '@/lib/accounting-dashboard-view';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';

export const dynamic = 'force-dynamic';

export default async function NyweAccountingDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return AccountingDashboardView({ productKey: PRODUCT_WINE_SPECTATOR, searchParams });
}
