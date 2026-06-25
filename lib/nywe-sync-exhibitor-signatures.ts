import { syncContractFromDocuSign } from '@/lib/docusign-envelope-sync';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import type { ContractWithTotals } from '@/types/db';

/** Reconcile NYWE licenses stuck at `sent` when the winery already signed in DocuSign. */
export async function syncNyweExhibitorSignaturesFromDocuSign(options?: {
  limit?: number;
  notify?: boolean;
}): Promise<{ synced: number; scanned: number }> {
  const event = await getActiveWineSpectatorEvent();
  if (!event) return { synced: 0, scanned: 0 };

  const limit = options?.limit ?? 25;
  const notify = options?.notify !== false;

  const supabase = getSupabaseAdmin();
  const { data: pending } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', event.id)
    .eq('status', 'sent')
    .not('docusign_envelope_id', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(limit);

  let synced = 0;
  for (const row of (pending ?? []) as ContractWithTotals[]) {
    const result = await syncContractFromDocuSign(supabase, row, event, null, { notify });
    if (result.ok && result.changed && result.toStatus === 'partially_signed') {
      synced += 1;
    }
  }

  return { synced, scanned: pending?.length ?? 0 };
}
