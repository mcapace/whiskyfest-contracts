import { requireContractActorForPage } from '@/lib/auth-contract';
import { PRODUCT_WHISKYFEST } from '@/lib/product-portal';
import { boothBrandRowsRecordFromMap, getConfirmedSponsors } from '@/lib/sponsors';
import { SponsorsDirectory } from '@/components/sponsors/sponsors-directory';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function SponsorsPage() {
  const actor = await requireContractActorForPage();
  const { sponsors, boothRowsByContract } = await getConfirmedSponsors(PRODUCT_WHISKYFEST);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-5xl font-medium tracking-tight text-foreground">Sponsors</h1>
        <p className="text-sm text-foreground">{sponsors.length} sponsors confirmed for WhiskyFest 2026</p>
      </header>

      <SponsorsDirectory
        sponsors={sponsors}
        boothRowsByContract={boothBrandRowsRecordFromMap(boothRowsByContract)}
        viewer={{
          role: actor.role,
          is_events_team: actor.isEventsTeam,
          is_accounting: actor.isAccounting,
          can_view_all_sales: actor.canViewAllSales,
          accessibleSalesRepIds: actor.accessibleSalesRepIds,
        }}
      />
    </div>
  );
}
