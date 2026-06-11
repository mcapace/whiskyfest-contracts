import { fetchExhibitorRoster } from '@/lib/exhibitor-roster';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { redirect } from 'next/navigation';
import { NyweLogo } from '@/components/brand/nywe-logo';
import { ExhibitorRosterPanel } from '@/components/wine-spectator/exhibitor-roster-panel';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorRosterPage() {
  const actor = await requireContractActorForPage();
  if (!actor.isAdmin && !actor.isEventsTeam) {
    redirect('/wine-spectator');
  }

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium">Exhibitor roster</h1>
        <p className="text-sm text-muted-foreground">No active Wine Spectator event configured.</p>
      </div>
    );
  }

  const roster = await fetchExhibitorRoster(event);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <NyweLogo className="max-w-[280px] shrink-0 sm:order-2" imageClassName="max-h-14" />
        <div className="min-w-0 sm:order-1">
        <h1 className="font-display text-3xl font-medium text-foreground">Exhibitor roster</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Live sync from Google Sheets for {event.name}. Create vendor licenses on demand, track signing in the app,
          and write status back to the sheet.
        </p>
        </div>
      </div>
      <ExhibitorRosterPanel
        initial={{
          syncedAt: roster.syncedAt,
          event: { id: event.id, name: event.name, client_send_enabled: event.client_send_enabled !== false },
          sheets: roster.sheets.map((sheet) => ({
            key: sheet.key,
            label: sheet.label,
            count: roster.rows.filter((row) => row.listKey === sheet.key).length,
          })),
          rows: roster.rows,
        }}
      />
    </div>
  );
}
