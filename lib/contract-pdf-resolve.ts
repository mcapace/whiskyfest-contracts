import type { SupabaseClient } from '@supabase/supabase-js';
import {
  contractDraftPdfPath,
  contractSignedPdfPath,
  downloadContractPdfFromStorage,
} from '@/lib/contract-pdf-storage';
import { contractPrefersSignedPdf } from '@/lib/contract-pdf-preview';
import { syncDraftPdfFromDocuSign } from '@/lib/contract-pdf-sync-docusign';
import type { Contract, ContractStatus } from '@/types/db';

export type ResolvedContractPdf =
  | { kind: 'bytes'; bytes: Buffer }
  | { kind: 'redirect'; url: string };

async function tryDownloadStorage(path: string): Promise<Buffer | null> {
  try {
    return await downloadContractPdfFromStorage(path);
  } catch {
    return null;
  }
}

/**
 * Resolve the PDF bytes (or external URL) for preview/download.
 * Syncs draft from DocuSign when storage is older than the last send.
 */
export async function resolveContractPdf(
  supabase: SupabaseClient,
  contract: Contract,
  variant: string,
): Promise<ResolvedContractPdf | null> {
  const id = contract.id;
  const status = contract.status as ContractStatus;
  const preferSigned = variant === 'signed' || (variant === 'auto' && contractPrefersSignedPdf(status));

  if (!preferSigned && (variant === 'auto' || variant === 'draft')) {
    try {
      await syncDraftPdfFromDocuSign(supabase, contract);
    } catch (err) {
      console.error('[resolveContractPdf] DocuSign draft sync failed', {
        contractId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (variant === 'draft' || (variant === 'auto' && !preferSigned)) {
    const bytes =
      (await tryDownloadStorage(contractDraftPdfPath(id))) ??
      (contract.pdf_storage_path?.endsWith('draft.pdf')
        ? await tryDownloadStorage(contract.pdf_storage_path)
        : null);
    if (bytes) return { kind: 'bytes', bytes };
    if (contract.draft_pdf_url) return { kind: 'redirect', url: contract.draft_pdf_url };
    return null;
  }

  if (variant === 'signed' || (variant === 'auto' && preferSigned)) {
    const bytes =
      (await tryDownloadStorage(contractSignedPdfPath(id))) ??
      (contract.pdf_storage_path?.endsWith('signed.pdf')
        ? await tryDownloadStorage(contract.pdf_storage_path)
        : null) ??
      (contract.signed_pdf_url && !/^https?:\/\//i.test(contract.signed_pdf_url)
        ? await tryDownloadStorage(contract.signed_pdf_url)
        : null);
    if (bytes) return { kind: 'bytes', bytes };
    if (contract.signed_pdf_url) return { kind: 'redirect', url: contract.signed_pdf_url };
    return null;
  }

  if (contract.pdf_storage_path) {
    const bytes = await tryDownloadStorage(contract.pdf_storage_path);
    if (bytes) return { kind: 'bytes', bytes };
  }

  const legacy = contract.signed_pdf_url ?? contract.draft_pdf_url;
  if (legacy) return { kind: 'redirect', url: legacy };

  return null;
}
