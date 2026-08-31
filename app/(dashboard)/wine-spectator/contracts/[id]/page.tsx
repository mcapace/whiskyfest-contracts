import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isNyweQrOnlyUser } from '@/lib/wine-spectator-access';
import { ContractDetailPage } from '@/lib/contract-detail-page';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorContractDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (isNyweQrOnlyUser(session?.user?.email) || session?.user?.is_qr_only) {
    redirect('/wine-spectator/qr');
  }
  return ContractDetailPage({ params, portalBasePath: '/wine-spectator' });
}
