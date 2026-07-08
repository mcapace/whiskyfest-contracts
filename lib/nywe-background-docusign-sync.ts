import { reconcileNyweDocuSignPipeline } from '@/lib/nywe-sync-exhibitor-signatures';
import { runBackgroundAccountingRelease } from '@/lib/background-accounting-release';

/**
 * Lightweight NYWE DocuSign reconciliation on dashboard/roster load.
 * Catches missed webhooks and stuck `signed` licenses without manual refresh.
 */
export async function runNyweBackgroundDocuSignSync(): Promise<void> {
  try {
    await Promise.all([
      reconcileNyweDocuSignPipeline({
        exhibitorBatchSize: 25,
        exhibitorAll: false,
        notify: false,
        releaseLimit: 40,
      }),
      runBackgroundAccountingRelease(),
    ]);
  } catch (err) {
    console.error('[nywe-background-docusign-sync]', err);
  }
}
