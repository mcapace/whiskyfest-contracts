import { reconcileNyweDocuSignPipeline } from '@/lib/nywe-sync-exhibitor-signatures';

/** Best-effort DocuSign poll on page load — no emails. Cron handles full sweeps. */
export async function runNyweBackgroundDocuSignSync(): Promise<void> {
  await reconcileNyweDocuSignPipeline({
    exhibitorBatchSize: 30,
    exhibitorAll: false,
    notify: false,
    releaseLimit: 25,
  }).catch((err) => console.error('[nywe] background DocuSign sync failed', err));
}
