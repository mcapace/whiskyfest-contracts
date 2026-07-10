import { getSupabaseAdmin } from '@/lib/supabase';

export const CONTRACT_PDFS_BUCKET = 'contract-pdfs';

export function contractDraftPdfPath(contractId: string): string {
  return `${contractId}/draft.pdf`;
}

export function contractRevisionUploadPath(contractId: string): string {
  return `${contractId}/revision-upload.pdf`;
}

export function contractSignedPdfPath(contractId: string): string {
  return `${contractId}/signed.pdf`;
}

export async function uploadContractPdfToStorage(objectPath: string, bytes: Buffer): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(CONTRACT_PDFS_BUCKET)
    .upload(objectPath, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
}

export async function downloadContractPdfFromStorage(objectPath: string): Promise<Buffer> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(CONTRACT_PDFS_BUCKET).download(objectPath);
  if (error || !data) throw error ?? new Error('Failed to download contract PDF from storage');
  return Buffer.from(await data.arrayBuffer());
}

export async function createContractPdfSignedUrl(objectPath: string, expiresSec = 3600): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(CONTRACT_PDFS_BUCKET)
    .createSignedUrl(objectPath, expiresSec);
  if (error || !data?.signedUrl) throw error ?? new Error('Failed to create signed URL for contract PDF');
  return data.signedUrl;
}

/** Upsert draft PDF in storage (canonical `{contractId}/draft.pdf`). */
export async function persistContractDraftPdf(
  contractId: string,
  pdfBytes: Buffer,
): Promise<{ draftStoragePath: string; drafted_at: string }> {
  const draftStoragePath = contractDraftPdfPath(contractId);
  await uploadContractPdfToStorage(draftStoragePath, pdfBytes);
  return { draftStoragePath, drafted_at: new Date().toISOString() };
}

/** Upsert signed/imported PDF at canonical `{contractId}/signed.pdf`. */
export async function persistContractSignedPdf(
  contractId: string,
  pdfBytes: Buffer,
): Promise<{ signedStoragePath: string }> {
  const signedStoragePath = contractSignedPdfPath(contractId);
  await uploadContractPdfToStorage(signedStoragePath, pdfBytes);
  return { signedStoragePath };
}

/** Load imported legacy PDF — supports canonical path and older `imported-contracts/…` keys. */
export async function downloadImportedContractPdf(contract: {
  id: string;
  pdf_storage_path: string | null;
  signed_pdf_url: string | null;
}): Promise<Buffer> {
  const candidates: string[] = [];
  const push = (p: string | null | undefined) => {
    const t = p?.trim();
    if (!t || candidates.includes(t)) return;
    candidates.push(t);
  };

  push(contract.pdf_storage_path);
  push(contractSignedPdfPath(contract.id));
  if (contract.signed_pdf_url && !/^https?:\/\//i.test(contract.signed_pdf_url)) {
    push(contract.signed_pdf_url);
  }

  let lastErr: unknown;
  for (const path of candidates) {
    try {
      return await downloadContractPdfFromStorage(path);
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('Imported PDF is missing from storage.');
}
