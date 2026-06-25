import type { ContractStatus } from '@/types/db';

export const NYWE_CLIENT_SEND_STATUSES = new Set<ContractStatus>([
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
]);

export function nyweContractReadyForClientSend(status: ContractStatus | null | undefined): boolean {
  return Boolean(status && NYWE_CLIENT_SEND_STATUSES.has(status));
}
