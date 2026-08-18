import { revalidatePath } from 'next/cache';
import { emitContractBroadcast } from '@/lib/realtime-server-broadcast';

/** Invalidate cached RSC payloads for contract detail + list after any mutation. */
export function revalidateContractPaths(contractId: string) {
  try {
    revalidatePath(`/contracts/${contractId}`);
    revalidatePath('/contracts');
    revalidatePath('/');
    revalidatePath(`/wine-spectator/contracts/${contractId}`);
    revalidatePath('/wine-spectator/contracts');
    revalidatePath('/wine-spectator');
    revalidatePath('/wine-spectator/roster');
    revalidatePath('/wine-spectator/qr');
  } catch {
    // Scripts and background jobs run outside a Next.js request — skip cache invalidation.
  }
  void emitContractBroadcast(contractId);
}
