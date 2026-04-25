import { requireContractActorForPage } from '@/lib/auth-contract';
import { getConfirmedSponsors } from '@/lib/sponsors';
import { SponsorsDirectory } from '@/components/sponsors/sponsors-directory';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function SponsorsPage() {
  const actor = await requireContractActorForPage();
  const sponsors = await getConfirmedSponsors();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-5xl font-medium tracking-tight text-oak-800">Sponsors</h1>
        <p className="text-sm text-ink-700">{sponsors.length} sponsors confirmed for WhiskyFest 2026</p>
      </header>

      <SponsorsDirectory
        sponsors={sponsors}
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
