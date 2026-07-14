import { AccountingDashboardView } from '@/lib/accounting-dashboard-view';
import { PRODUCT_BIG_SMOKE } from '@/lib/product-portal';

export const dynamic = 'force-dynamic';

export default async function BigSmokeAccountingDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return AccountingDashboardView({ productKey: PRODUCT_BIG_SMOKE, searchParams });
}
