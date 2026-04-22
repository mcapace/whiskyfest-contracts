import { revalidatePath } from 'next/cache';

/** Invalidate cached RSC payloads for contract detail + list after any mutation. */
export function revalidateContractPaths(contractId: string) {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath('/contracts');
  revalidatePath('/');
}
