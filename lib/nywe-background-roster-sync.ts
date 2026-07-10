import {
  syncExhibitorRosterMaster,
  type ExhibitorRosterSyncResult,
} from '@/lib/exhibitor-roster-sync-job';
import { rosterSheetsFromEvent } from '@/lib/exhibitor-roster';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { revalidatePath } from 'next/cache';

/** Skip background pull when cron runs — do not trigger from page views. */
export const NYWE_ROSTER_BACKGROUND_SYNC_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Refresh NYWE master Google Sheets into Supabase when stale.
 * Call without await on dashboard pages — a full sync can exceed serverless time limits.
 */
export async function runNyweBackgroundRosterSync(options?: {
  maxAgeMs?: number;
}): Promise<ExhibitorRosterSyncResult | null> {
  try {
    const event = await getActiveWineSpectatorEvent();
    if (!event || rosterSheetsFromEvent(event).length === 0) return null;

    const maxAgeMs = options?.maxAgeMs ?? NYWE_ROSTER_BACKGROUND_SYNC_MAX_AGE_MS;
    const lastSyncedAt = event.roster_last_synced_at ? Date.parse(event.roster_last_synced_at) : 0;
    if (lastSyncedAt > 0 && Date.now() - lastSyncedAt < maxAgeMs) return null;

    const outcome = await syncExhibitorRosterMaster(event);
    if (outcome.status === 'synced') {
      revalidatePath('/wine-spectator');
      revalidatePath('/wine-spectator/roster');
      revalidatePath('/wine-spectator/contracts');
    }
    return outcome;
  } catch (err) {
    console.error('[nywe-background-roster-sync]', err);
    return null;
  }
}

/** Fire-and-forget roster sync — never block page render on Google Sheets. */
export function scheduleNyweBackgroundRosterSync(): void {
  void runNyweBackgroundRosterSync().catch((err) => {
    console.error('[nywe-background-roster-sync] scheduled run failed', err);
  });
}
