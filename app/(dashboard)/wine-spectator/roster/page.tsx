import { redirect } from 'next/navigation';
import { loadExhibitorRosterForPage } from '@/lib/exhibitor-roster-sync-job';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { scheduleNyweBackgroundDocuSignSync } from '@/lib/nywe-background-docusign-sync';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { isNyweQrOnlyUser } from '@/lib/wine-spectator-access';
import { buildNyweDashboardMetrics } from '@/lib/nywe-dashboard-metrics';
import { getNyweEventContractsForMetrics } from '@/lib/nywe-event-contracts';
import { ExhibitorRosterPanel } from '@/components/wine-spectator/exhibitor-roster-panel';
import { NyweMetricsGrid } from '@/components/wine-spectator/nywe-metrics-grid';
import { NyweRosterPageHeader } from '@/components/wine-spectator/nywe-quick-nav';

export const dynamic = 'force-dynamic';

export default async function WineSpectatorRosterPage() {
  const actor = await requireContractActorForPage();
  if (actor.isQrOnly || isNyweQrOnlyUser(actor.email)) {
    redirect('/wine-spectator/qr');
  }

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return (
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-medium">Exhibitor roster</h1>
        <p className="text-sm text-muted-foreground">No active NYWE event configured.</p>
      </div>
    );
  }

  try {
    scheduleNyweBackgroundDocuSignSync();

    const [{ roster, fromCache, stale, fetchError, warnings }, contracts] = await Promise.all([
      loadExhibitorRosterForPage(event),
      getNyweEventContractsForMetrics(event.id),
    ]);

    const active = contracts.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');
    const metrics = buildNyweDashboardMetrics(active, event, { rosterWineryCount: roster.rows.length });

    return (
      <div className="space-y-10">
        <NyweRosterPageHeader eventName={event.name} />
        <NyweMetricsGrid metrics={metrics} compact />
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
      <div className="space-y-4 px-4 py-6">
        <h1 className="font-display text-3xl font-medium text-foreground">Exhibitor roster</h1>
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {message}
        </div>
        <p className="text-sm text-muted-foreground">
          Try refreshing after confirming the Google service account still has access to the NYWE exhibitor spreadsheets.
        </p>
      </div>
    );
  }
}
