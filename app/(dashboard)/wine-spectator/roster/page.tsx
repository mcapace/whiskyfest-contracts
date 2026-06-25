import { loadExhibitorRoster } from '@/lib/exhibitor-roster-sync-job';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { runNyweBackgroundDocuSignSync } from '@/lib/nywe-background-docusign-sync';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { NyweLogo } from '@/components/brand/nywe-logo';
import { ExhibitorRosterPanel } from '@/components/wine-spectator/exhibitor-roster-panel';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorRosterPage() {
  await requireContractActorForPage();

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium">Exhibitor roster</h1>
        <p className="text-sm text-muted-foreground">No active Wine Spectator event configured.</p>
      </div>
    );
  }

  try {
    const [{ roster, fromCache, stale, fetchError, warnings }] = await Promise.all([
      loadExhibitorRoster(event),
      runNyweBackgroundDocuSignSync(),
    ]);

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <NyweLogo className="max-w-[280px] shrink-0 sm:order-2" imageClassName="max-h-14 drop-shadow-sm" />
          <div className="min-w-0 sm:order-1">
            <h1 className="font-display text-3xl font-medium text-foreground">Exhibitor roster</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Master lists sync from Google Sheets every 30 minutes for {event.name}. Create vendor licenses on demand,
              track signing in the app, and write status back to the sheet.
            </p>
          </div>
        </div>
        <ExhibitorRosterPanel
          initial={{
            syncedAt: roster.syncedAt,
            fromCache,
            stale,
            fetchError,
            warnings,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load exhibitor roster from Google Sheets.';
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-medium text-foreground">Exhibitor roster</h1>
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {message}
        </div>
        <p className="text-sm text-muted-foreground">
          Try &quot;Refresh from sheets&quot; after confirming the Google service account still has access to the NYWE
          exhibitor spreadsheets, or contact support if this persists.
        </p>
      </div>
    );
  }
}
