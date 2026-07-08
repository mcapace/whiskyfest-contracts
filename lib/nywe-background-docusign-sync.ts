import { releaseSignedContractsToAccounting } from '@/lib/nywe-release-stuck-on-load';

/**
 * Lightweight NYWE dashboard hook — releases stuck accounting handoffs only.
 * DocuSign reconciliation runs on the 10-minute cron (not every page refresh).
 */
export async function runNyweBackgroundDocuSignSync(): Promise<void> {
  try {
    await releaseSignedContractsToAccounting({ limit: 40 });
  } catch (err) {
    console.error('[nywe-background-docusign-sync]', err);
  }
}
