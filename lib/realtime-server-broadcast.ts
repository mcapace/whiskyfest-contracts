import { getSupabaseAdmin } from '@/lib/supabase';

const CHANNEL = 'wf_contracts_global';
const EVENT = 'contract_changed';

/**
 * Broadcasts a lightweight contract-changed event over Supabase Realtime (broadcast channel).
 * Clients use the anon key + the same channel name — no postgres_changes / RLS required.
 * Fire-and-forget; safe to call from any server route after mutations.
 */
export function emitContractBroadcast(contractId: string): void {
  void (async () => {
    try {
      const supabase = getSupabaseAdmin();
      const ch = supabase.channel(CHANNEL);
      await new Promise<void>((resolve, reject) => {
        ch.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') resolve();
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(String(status)));
        });
      });
      await ch.send({
        type: 'broadcast',
        event: EVENT,
        payload: { contractId },
      });
      await supabase.removeChannel(ch);
    } catch (e) {
      console.warn('[emitContractBroadcast]', e);
    }
  })();
}
