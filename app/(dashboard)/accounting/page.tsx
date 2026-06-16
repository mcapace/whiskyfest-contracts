import { AccountingDashboardView } from '@/lib/accounting-dashboard-view';
import { PRODUCT_WHISKYFEST } from '@/lib/product-portal';

export const dynamic = 'force-dynamic';

export default async function WhiskyfestAccountingDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return AccountingDashboardView({ productKey: PRODUCT_WHISKYFEST, searchParams });
}
