import { getActiveWineSpectatorEvent } from '../lib/wine-spectator-event';
import { fetchExhibitorRoster } from '../lib/exhibitor-roster';
import { createContractsFromRosterRows } from '../lib/exhibitor-roster-create';
import { getSupabaseAdmin } from '../lib/supabase';
import { fetchContractWithTotalsById } from '../lib/contract-with-totals';
import { renderContractPdfFromTemplate, uploadPdfBufferToFolder } from '../lib/google';
import { buildContractMergeMap } from '../lib/merge-map';
import { resolveContractTemplateDocId } from '../lib/contract-template';
import { contractPdfBaseName } from '../lib/contract-document-naming';
import { fetchContractBoothBrandsOrdered } from '../lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '../lib/contract-line-items';
import { eventUsesContractOrderTable } from '../lib/contract-template-profile';
import { isSponsorshipOnlyOrder } from '../lib/contract-order-type';
import { uploadContractPdfToStorage, contractDraftPdfPath } from '../lib/contract-pdf-storage';

async function main() {
  const event = await getActiveWineSpectatorEvent();
  if (!event) throw new Error('No NYWE event');

  const roster = await fetchExhibitorRoster(event);
  const candidate =
    roster.rows.find((r) => !r.contractId && r.signerEmail && r.listKey === 'champagne') ??
    roster.rows.find((r) => !r.contractId && r.signerEmail);

  if (!candidate) throw new Error('No roster row without a license found for smoke test');

  console.log('Test winery:', candidate.wineryName);
  console.log('Signer:', candidate.signerEmail);

  const create = await createContractsFromRosterRows({
    event,
    items: [{ rowKey: candidate.rowKey, listKey: candidate.listKey }],
    actorEmail: 'nywe-smoke-test@mshanken.com',
  });

  if (create.errors.length) throw new Error(create.errors[0]?.reason ?? 'Create failed');
  if (create.skipped.length) {
    console.log('Skipped (already exists):', create.skipped[0]?.reason);
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('contracts')
      .select('id')
      .eq('source_sheet_id', candidate.spreadsheetId)
      .eq('source_sheet_tab', candidate.tab)
      .eq('source_row_number', candidate.rowNumber)
      .maybeSingle();
    if (!data?.id) throw new Error('Could not find existing contract');
    console.log('Using existing contract:', data.id);
    return finishPdfTest(data.id, event.id);
  }

  const contractId = create.created[0]?.contractId;
  if (!contractId) throw new Error('No contract id returned');
  console.log('Created draft:', contractId);

  await finishPdfTest(contractId, event.id);
}

async function finishPdfTest(contractId: string, eventId: string) {
  const supabase = getSupabaseAdmin();
  const contract = await fetchContractWithTotalsById(supabase, contractId);
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (!contract || !event) throw new Error('Contract or event missing');

  const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);
  const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
  const mergeMap = buildContractMergeMap(contract, event, 'draft', boothBrands);
  const templateDocId = resolveContractTemplateDocId(contract, event);
  const fileName = contractPdfBaseName(contract.exhibitor_company_name, event);
  const usesOrderTable = eventUsesContractOrderTable(event);

  const pdfBytes = await renderContractPdfFromTemplate(
    templateDocId,
    mergeMap,
    fileName,
    usesOrderTable ? lineItems : undefined,
    { includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract) },
  );
  console.log('PDF generated:', pdfBytes.length, 'bytes');

  const draftsFolderId = process.env.GOOGLE_DRAFTS_FOLDER_ID;
  if (!draftsFolderId) throw new Error('GOOGLE_DRAFTS_FOLDER_ID missing');
  const { fileId, webViewLink } = await uploadPdfBufferToFolder(pdfBytes, fileName, draftsFolderId);
  const draftStoragePath = contractDraftPdfPath(contract.id);
  await uploadContractPdfToStorage(draftStoragePath, pdfBytes);

  await supabase
    .from('contracts')
    .update({
      draft_pdf_drive_id: fileId,
      draft_pdf_url: webViewLink,
      drafted_at: new Date().toISOString(),
      pdf_storage_path: draftStoragePath,
      status: 'pending_events_review',
      events_submitted_at: new Date().toISOString(),
    })
    .eq('id', contract.id);

  console.log('PASS | Draft + PDF + pending review');
  console.log('Contract URL: https://wacontracts.whiskyadvocate.com/wine-spectator/contracts/' + contract.id);
  console.log('PDF:', webViewLink);
  console.log('Next: Susannah opens contract → Approve → Send selected (manual DocuSign test)');
}

main().catch((e) => {
  console.error('FAIL |', e instanceof Error ? e.message : e);
  process.exit(1);
});
