import { getSupabaseAdmin } from '@/lib/supabase';
import { autoReleaseNyweAfterCountersign } from '@/lib/nywe-auto-release-accounting';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import type { ContractWithTotals } from '@/types/db';

export type NyweAccountingReleaseResult = {
  scanned: number;
  released: number;
  failed: number;
  errorSamples: { id: string; company: string; error: string }[];
};

/** Release NYWE licenses countersigned in DocuSign but still stuck at `signed`. */
export async function releaseNyweSignedLicensesToAccounting(options?: {
  limit?: number;
}): Promise<NyweAccountingReleaseResult> {
  const event = await getActiveWineSpectatorEvent();
  const empty: NyweAccountingReleaseResult = {
    scanned: 0,
    released: 0,
    failed: 0,
    errorSamples: [],
  };
  if (!event) return empty;

  const supabase = getSupabaseAdmin();
  const { data: stuck } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', event.id)
    .eq('status', 'signed')
    .is('executed_at', null)
    .limit(options?.limit ?? 50);

  const result = { ...empty, scanned: stuck?.length ?? 0 };

  for (const row of (stuck ?? []) as ContractWithTotals[]) {
    const release = await autoReleaseNyweAfterCountersign({
      supabase,
      contractId: row.id,
      event,
      countersignerEmail: row.countersigned_by_email,
    });
    if (release.released) {
      result.released += 1;
    } else if (release.error) {
      result.failed += 1;
      if (result.errorSamples.length < 8) {
        result.errorSamples.push({
          id: row.id,
          company: row.exhibitor_company_name,
          error: release.error,
        });
      }
    }
  }

  return result;
}

/** On dashboard load, release any NYWE licenses Susannah countersigned but accounting never received. */
export async function releaseStuckNyweSignedLicenses(): Promise<number> {
  const result = await releaseNyweSignedLicensesToAccounting({ limit: 25 });
  return result.released;
}
