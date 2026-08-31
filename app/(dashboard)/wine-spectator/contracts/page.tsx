import { redirect } from 'next/navigation';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { isNyweQrOnlyUser } from '@/lib/wine-spectator-access';
import { ContractsList } from '@/components/contracts/contracts-list';
import { loadContracts } from '@/app/(dashboard)/contracts/page';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorContractsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireContractActorForPage();
  if (actor.isQrOnly || isNyweQrOnlyUser(actor.email)) {
    redirect('/wine-spectator/qr');
  }
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;

  const { contracts, events, boothRowsByContract } = await loadContracts(
    actor,
    { status, q },
    PRODUCT_WINE_SPECTATOR,
  );

  return (
    <div className="space-y-6">
      <ContractsList
        contracts={contracts}
        events={events}
        currentRepId={actor.salesRepId}
        boothRowsByContract={boothRowsByContract}
        portalBasePath="/wine-spectator"
        winePortal
      />
    </div>
  );
}
