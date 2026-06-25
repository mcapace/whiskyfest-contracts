import type { Contract, ContractWithTotals } from '@/types/db';

type ImportMarker = Pick<Contract, 'imported_at'> | Pick<ContractWithTotals, 'imported_at'>;

export function isLegacyImportedContract(c: ImportMarker): boolean {
  return Boolean(c.imported_at?.trim());
}

/** Legacy import awaiting Nicole / events review (includes pre-migration `imported` status). */
export function awaitsEventsReviewForLegacyImport(
  c: Pick<Contract, 'status' | 'imported_at'>,
): boolean {
  if (c.status === 'imported') return true;
  return c.status === 'pending_events_review' && isLegacyImportedContract(c);
}
