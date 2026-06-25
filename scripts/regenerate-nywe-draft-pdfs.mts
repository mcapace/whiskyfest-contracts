#!/usr/bin/env npx tsx
/**
 * Regenerate stored draft PDFs for all NYWE roster licenses (Drive + Supabase storage).
 *
 * Usage:
 *   npx tsx scripts/regenerate-nywe-draft-pdfs.mts
 *   npx tsx scripts/regenerate-nywe-draft-pdfs.mts --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { renderNyweLiveDraftPdf } from '../lib/nywe-live-draft-pdf.ts';
import { uploadPdfBufferToFolder } from '../lib/google.ts';
import { contractDraftPdfPath, uploadContractPdfToStorage } from '../lib/contract-pdf-storage.ts';
import { contractPdfBaseName } from '../lib/contract-document-naming.ts';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const draftsFolderId = process.env['GOOGLE_DRAFTS_FOLDER_ID'];
  if (!url || !key) throw new Error('Missing Supabase env vars');
  if (!dryRun && !draftsFolderId) throw new Error('Missing GOOGLE_DRAFTS_FOLDER_ID');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: event } = await supabase.from('events').select('id,name').eq('product_key', 'wine_spectator').single();
  if (!event) throw new Error('NYWE event not found');

  const { data: contracts } = await supabase
    .from('contracts_with_totals')
    .select('id,exhibitor_company_name,status')
    .eq('event_id', event.id)
    .in('status', ['draft', 'ready_for_review', 'pending_events_review', 'approved']);

  for (const row of contracts ?? []) {
    if (dryRun) {
      console.log(`[dry-run] would regenerate ${row.exhibitor_company_name} (${row.id})`);
      continue;
    }
    const pdfBytes = await renderNyweLiveDraftPdf(supabase, row.id);
    if (!pdfBytes) {
      console.error('Skip — render failed:', row.exhibitor_company_name);
      continue;
    }
    const { data: fullEvent } = await supabase.from('events').select('*').eq('id', event.id).single();
    const fileName = contractPdfBaseName(row.exhibitor_company_name, fullEvent!);
    const { fileId, webViewLink } = await uploadPdfBufferToFolder(pdfBytes, fileName, draftsFolderId!);
    const draftStoragePath = contractDraftPdfPath(row.id);
    await uploadContractPdfToStorage(draftStoragePath, pdfBytes);
    const nowIso = new Date().toISOString();
    await supabase
      .from('contracts')
      .update({
        draft_pdf_drive_id: fileId,
        draft_pdf_url: webViewLink,
        drafted_at: nowIso,
        pdf_storage_path: draftStoragePath,
      })
      .eq('id', row.id);
    console.log('Regenerated:', row.exhibitor_company_name, webViewLink);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
