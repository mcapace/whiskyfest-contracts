import type { ContractStatus } from '@/types/db';

/** Statuses where the countersigned / executed PDF should be shown when available. */
export function contractPrefersSignedPdf(status: ContractStatus): boolean {
  return status === 'signed' || status === 'executed' || status === 'imported';
}

/** True when stored draft is older than the DocuSign envelope that was sent. */
export function contractPreviewPdfStale(contract: {
  status: ContractStatus;
  docusign_envelope_id: string | null;
  sent_at: string | null;
  drafted_at: string | null;
}): boolean {
  if (!contract.docusign_envelope_id?.trim()) return false;
  if (!['sent', 'partially_signed', 'approved', 'error'].includes(contract.status)) return false;
  if (!contract.sent_at) return false;
  if (!contract.drafted_at) return true;
  return new Date(contract.sent_at).getTime() > new Date(contract.drafted_at).getTime();
}

/** Cache-buster token for inline preview URLs (changes when PDF is regenerated or signed). */
export function contractPdfPreviewVersion(contract: {
  signed_at: string | null;
  drafted_at: string | null;
  sent_at: string | null;
  updated_at: string;
}): string {
  const parts = [contract.signed_at, contract.drafted_at, contract.sent_at, contract.updated_at].filter(
    Boolean,
  ) as string[];
  if (parts.length === 0) return contract.updated_at;
  return parts.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]!;
}

export function contractPdfPreviewUrl(contractId: string, version: string): string {
  const params = new URLSearchParams({ variant: 'auto' });
  if (version) params.set('v', version);
  return `/api/contracts/${contractId}/pdf?${params.toString()}`;
}
