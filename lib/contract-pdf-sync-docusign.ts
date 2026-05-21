import type { SupabaseClient } from '@supabase/supabase-js';
import { downloadEnvelopeContractPdf } from '@/lib/docusign';
import { persistContractDraftPdf } from '@/lib/contract-pdf-storage';
import { contractPreviewPdfStale } from '@/lib/contract-pdf-preview';
import type { Contract } from '@/types/db';

/** Pull the active DocuSign envelope PDF into `{contractId}/draft.pdf` for inline preview. */
export async function syncDraftPdfFromDocuSign(
  supabase: SupabaseClient,
  contract: Pick<
    Contract,
    'id' | 'status' | 'docusign_envelope_id' | 'sent_at' | 'drafted_at'
  >,
): Promise<{ synced: boolean; drafted_at: string | null }> {
  if (!contractPreviewPdfStale(contract)) {
    return { synced: false, drafted_at: contract.drafted_at };
  }

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return { synced: false, drafted_at: contract.drafted_at };
  }

  const pdfBytes = await downloadEnvelopeContractPdf(envelopeId);
  const { draftStoragePath, drafted_at } = await persistContractDraftPdf(contract.id, pdfBytes);

  await supabase
    .from('contracts')
    .update({
      pdf_storage_path: draftStoragePath,
      drafted_at,
    })
    .eq('id', contract.id);

  return { synced: true, drafted_at };
}
