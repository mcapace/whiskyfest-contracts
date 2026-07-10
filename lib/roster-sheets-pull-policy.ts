import { getSupabaseAdmin } from '@/lib/supabase';
import type { Event } from '@/types/db';

/** Min seconds between manual Google Sheets roster pulls (per event). */
export const ROSTER_LIVE_PULL_MIN_INTERVAL_MS = 90 * 1000;

export function msUntilNextLiveRosterPull(event: Pick<Event, 'roster_live_pull_at'>): number {
  const last = event.roster_live_pull_at ? Date.parse(event.roster_live_pull_at) : 0;
  if (!Number.isFinite(last) || last <= 0) return 0;
  return Math.max(0, ROSTER_LIVE_PULL_MIN_INTERVAL_MS - (Date.now() - last));
}

export function liveRosterPullAllowed(event: Pick<Event, 'roster_live_pull_at'>): boolean {
  return msUntilNextLiveRosterPull(event) === 0;
}

export function formatRosterPullWaitMessage(ms: number): string {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `Try again in ${min}m ${sec}s.`;
  return `Try again in ${sec}s.`;
}

export function isGoogleSheetsQuotaError(message: string): boolean {
  return /quota exceeded/i.test(message);
}

/** Claim a live pull slot — returns false if another pull ran too recently. */
export async function tryBeginLiveRosterPull(eventId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - ROSTER_LIVE_PULL_MIN_INTERVAL_MS).toISOString();
  const now = new Date().toISOString();

  const { data: current } = await supabase
    .from('events')
    .select('roster_live_pull_at')
    .eq('id', eventId)
    .maybeSingle();

  const last = current?.roster_live_pull_at;
  if (last && last > cutoff) return false;

  const { data: updated, error } = await supabase
    .from('events')
    .update({ roster_live_pull_at: now })
    .eq('id', eventId)
    .or(`roster_live_pull_at.is.null,roster_live_pull_at.lt.${cutoff}`)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[tryBeginLiveRosterPull]', eventId, error.message);
    return false;
  }
  return Boolean(updated);
}

export async function markLiveRosterPullFinished(eventId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from('events').update({ roster_live_pull_at: new Date().toISOString() }).eq('id', eventId);
}
