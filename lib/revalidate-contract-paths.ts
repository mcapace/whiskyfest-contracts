import { revalidatePath } from 'next/cache';
import { emitContractBroadcast } from '@/lib/realtime-server-broadcast';

/** Invalidate cached RSC payloads for contract detail + list after any mutation. */
export function revalidateContractPaths(contractId: string) {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath('/contracts');
  revalidatePath('/');
  emitContractBroadcast(contractId);
}
