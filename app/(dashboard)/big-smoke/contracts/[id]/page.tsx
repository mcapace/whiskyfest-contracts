import { ContractDetailPage } from '@/lib/contract-detail-page';

export const dynamic = 'force-dynamic';

export default async function BigSmokeContractDetailPage({ params }: { params: { id: string } }) {
  return ContractDetailPage({ params, portalBasePath: '/big-smoke' });
}
