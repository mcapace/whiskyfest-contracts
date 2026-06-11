import { requireContractActorForPage } from '@/lib/auth-contract';
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
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;

  const { contracts, events, boothRowsByContract } = await loadContracts(
    actor,
    { status, q },
    PRODUCT_WINE_SPECTATOR,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-foreground">Wine Spectator licenses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          New York Wine Experience vendor agreements — separate from WhiskyFest contracts.
        </p>
      </div>
      <ContractsList
        contracts={contracts}
        events={events}
        currentRepId={actor.salesRepId}
        boothRowsByContract={boothRowsByContract}
        portalBasePath="/wine-spectator"
      />
    </div>
  );
}
