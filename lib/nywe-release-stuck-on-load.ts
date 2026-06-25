import { getSupabaseAdmin } from '@/lib/supabase';
import { autoReleaseNyweAfterCountersign } from '@/lib/nywe-auto-release-accounting';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import type { ContractWithTotals } from '@/types/db';

/** On dashboard load, release any NYWE licenses Susannah countersigned but accounting never received. */
export async function releaseStuckNyweSignedLicenses(): Promise<number> {
  const event = await getActiveWineSpectatorEvent();
  if (!event) return 0;

  const supabase = getSupabaseAdmin();
  const { data: stuck } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', event.id)
    .eq('status', 'signed')
    .is('executed_at', null)
    .limit(25);

  let released = 0;
  for (const row of (stuck ?? []) as ContractWithTotals[]) {
    const result = await autoReleaseNyweAfterCountersign({
      supabase,
      contractId: row.id,
      event,
      countersignerEmail: row.countersigned_by_email,
    });
    if (result.released) released += 1;
  }
  return released;
}
