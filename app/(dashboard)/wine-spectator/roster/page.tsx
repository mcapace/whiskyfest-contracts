import { loadExhibitorRoster } from '@/lib/exhibitor-roster-sync-job';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { ExhibitorRosterPanel } from '@/components/wine-spectator/exhibitor-roster-panel';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorRosterPage() {
  await requireContractActorForPage();

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return (
      <p className="text-sm text-muted-foreground">No active Wine Spectator event configured.</p>
    );
  }

  const { roster } = await loadExhibitorRoster(event);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Synced from Google Sheets for {event.name}. Create licenses on demand and write signing status back to the sheet.
      </p>
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
