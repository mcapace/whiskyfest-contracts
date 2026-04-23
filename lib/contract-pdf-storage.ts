import { getSupabaseAdmin } from '@/lib/supabase';

export const CONTRACT_PDFS_BUCKET = 'contract-pdfs';

export function contractDraftPdfPath(contractId: string): string {
  return `${contractId}/draft.pdf`;
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
