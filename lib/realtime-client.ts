import { createClient, type RealtimeChannel } from '@supabase/supabase-js';

const CHANNEL = 'wf_contracts_global';
const EVENT = 'contract_changed';

function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type ContractChangePayload = { contractId?: string };

/** @deprecated alias — use subscribeToAppContractEvents */
export function subscribeToContracts(onPayload: (payload: ContractChangePayload) => void): () => void {
  return subscribeToAppContractEvents((id) => onPayload({ contractId: id }));
}

/** Audit / activity: same broadcast as contract updates (activity follows contract writes). */
export function subscribeToActivity(onPayload: (payload: ContractChangePayload) => void): () => void {
  return subscribeToAppContractEvents((id) => onPayload({ contractId: id }));
}

export function subscribeToAppContractEvents(handler: (contractId: string | undefined) => void): () => void {
  const supabase = getBrowserSupabase();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
    .channel(CHANNEL)
    .on('broadcast', { event: EVENT }, ({ payload }) => {
      const contractId =
        payload && typeof payload === 'object' && 'contractId' in payload
          ? String((payload as { contractId?: string }).contractId ?? '')
          : undefined;
      handler(contractId || undefined);
    });

  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
