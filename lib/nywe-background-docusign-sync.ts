import { syncNyweExhibitorSignaturesFromDocuSign } from '@/lib/nywe-sync-exhibitor-signatures';

/** Best-effort DocuSign poll on page load — no UI, no emails. Cron handles full sweeps. */
export async function runNyweBackgroundDocuSignSync(): Promise<void> {
  await syncNyweExhibitorSignaturesFromDocuSign({ batchSize: 30, notify: false }).catch((err) =>
    console.error('[nywe] background DocuSign sync failed', err),
  );
}
