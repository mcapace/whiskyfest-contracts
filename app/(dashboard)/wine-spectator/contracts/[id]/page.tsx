import { ContractDetailPage } from '@/lib/contract-detail-page';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorContractDetailPage({ params }: { params: { id: string } }) {
  return ContractDetailPage({ params, portalBasePath: '/wine-spectator' });
}
