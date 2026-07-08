import type { SupabaseClient } from '@supabase/supabase-js';

/** Minimum interval between DocuSign polls for the same contract (background sync). */
export const DOCUSIGN_POLL_COOLDOWN_MS = 20 * 60 * 1000;

export function docuSignPollEligible(
  lastPolledAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!lastPolledAt) return true;
  const parsed = Date.parse(lastPolledAt);
  if (Number.isNaN(parsed)) return true;
  return nowMs - parsed >= DOCUSIGN_POLL_COOLDOWN_MS;
}

export function docuSignPollCutoffIso(nowMs = Date.now()): string {
  return new Date(nowMs - DOCUSIGN_POLL_COOLDOWN_MS).toISOString();
}

export async function touchDocuSignPoll(
  supabase: SupabaseClient,
  contractId: string,
): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ docusign_last_polled_at: new Date().toISOString() })
    .eq('id', contractId);
  if (error) {
    console.warn('[docusign-poll] touch failed', { contractId, error: error.message });
  }
}
