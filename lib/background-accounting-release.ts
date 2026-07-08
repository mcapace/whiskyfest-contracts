import { releaseSignedContractsToAccounting } from '@/lib/nywe-release-stuck-on-load';

/** Release stuck signed→executed contracts on dashboard load (no DocuSign polling — cron handles that). */
export async function runBackgroundAccountingRelease(): Promise<void> {
  try {
    await releaseSignedContractsToAccounting({ limit: 40 });
  } catch (err) {
    console.error('[background-accounting-release]', err);
  }
}
