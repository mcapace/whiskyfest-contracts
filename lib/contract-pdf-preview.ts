import type { ContractStatus } from '@/types/db';

/** Statuses where the countersigned / executed PDF should be shown when available. */
export function contractPrefersSignedPdf(status: ContractStatus): boolean {
  return status === 'signed' || status === 'executed' || status === 'imported';
}

/** Cache-buster token for inline preview URLs (changes when PDF is regenerated or signed). */
export function contractPdfPreviewVersion(contract: {
  signed_at: string | null;
  drafted_at: string | null;
  sent_at: string | null;
  updated_at: string;
}): string {
  return contract.signed_at ?? contract.drafted_at ?? contract.sent_at ?? contract.updated_at;
}

export function contractPdfPreviewUrl(contractId: string, version: string): string {
  const params = new URLSearchParams({ variant: 'auto' });
  if (version) params.set('v', version);
  return `/api/contracts/${contractId}/pdf?${params.toString()}`;
}
