import { releaseSignedContractsToAccounting } from '@/lib/nywe-release-stuck-on-load';
import { syncActiveEventExhibitorSignaturesFromDocuSign } from '@/lib/exhibitor-docusign-sync';

/** WhiskyFest + NYWE: reconcile DocuSign + release signed contracts on dashboard load. */
export async function runBackgroundAccountingRelease(): Promise<void> {
  try {
    await Promise.all([
      syncActiveEventExhibitorSignaturesFromDocuSign({ batchSize: 25, notify: false }),
      releaseSignedContractsToAccounting({ limit: 40 }),
    ]);
  } catch (err) {
    console.error('[background-accounting-release]', err);
  }
}
