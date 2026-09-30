import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchContractBoothBrandsOrdered } from '@/lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import { contractPdfBaseName } from '@/lib/contract-document-naming';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { persistContractDraftPdf } from '@/lib/contract-pdf-storage';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { contractUsesOrderTable } from '@/lib/contract-template-profile';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { insertContractAudit } from '@/lib/audit-log';
import { buildContractMergeMap } from '@/lib/merge-map';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { buildContractRevisionPlan } from '@/lib/contract-revision-plan-service';
import { buildRevisionPatch, type ReviseAndSendBody } from '@/lib/contract-revision';
import {
  mergeRevisionPlans,
  parseStoredRevisionPlan,
  revisionPlanToDisplayLines,
  type ContractRevisionPlan,
} from '@/lib/contract-revision-plan';
import type { ContractStatus, Event } from '@/types/db';

/** Statuses where amendments can be applied without touching DocuSign (nothing has been sent). */
export const APPLY_AMENDMENTS_STATUSES: ContractStatus[] = [
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
];

/**
 * Bake client amendments into an unsent contract: persist the edit plan + record changes and
 * regenerate the stored draft PDF so what the team sees (and later sends) is the clean version.
 */
export async function applyContractRevision(options: {
  contractId: string;
  actorEmail: string;
  body: ReviseAndSendBody;
}): Promise<{ plan: ContractRevisionPlan | null; previewLines: string[] }> {
  const supabase = getSupabaseAdmin();
  const { contractId, actorEmail, body } = options;

  let contract = await fetchContractWithTotalsById(supabase, contractId);
  if (!contract) throw new Error('Contract not found');
  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) throw new Error('Event not found');

  if (!APPLY_AMENDMENTS_STATUSES.includes(contract.status)) {
    throw new Error(
      'Amendments can be applied before the contract is sent. For a sent contract use Revise and Send.',
    );
  }

  let plan = body.revision_plan ?? null;
  const changeRequest = body.change_request?.trim() ?? '';
  if (!plan && changeRequest.length >= 10) {
    plan = (
      await buildContractRevisionPlan({
        contract,
        event,
        changeRequest,
        revisionUploadPath: null,
      })
    ).plan;
  }
  const existingPlan = parseStoredRevisionPlan(contract.revision_plan);
  if (plan && existingPlan && !body.replace_existing_edits) plan = mergeRevisionPlans(existingPlan, plan);

  const patch = buildRevisionPatch(body, contract, plan);
  // Not a resend round: keep the round counter and the uploaded-PDF switch untouched.
  delete patch.revision_round;
  delete patch.revision_use_uploaded_pdf;
  if (!plan && body.replace_existing_edits && existingPlan) patch.revision_plan = null;

  const { error: patchError } = await supabase.from('contracts').update(patch).eq('id', contractId);
  if (patchError) throw new Error(patchError.message);

  contract = (await fetchContractWithTotalsById(supabase, contractId))!;

  // Regenerate the stored draft so the portal PDF shows the clean, amended contract.
  const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
  const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);
  const mergeMap = buildContractMergeMap(contract, event, 'draft', boothBrands);
  const templateDocId = resolveContractTemplateDocId(contract, event);
  const usesOrderTable = contractUsesOrderTable(event, contract);
  const pdfBytes = await renderContractPdfFromTemplate(
    templateDocId,
    mergeMap,
    contractPdfBaseName(contract.exhibitor_company_name, event),
    usesOrderTable ? lineItems : undefined,
    {
      includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract),
      revisionPlan: parseStoredRevisionPlan(contract.revision_plan),
      strictRevision: true,
    },
  );
  const { draftStoragePath, drafted_at } = await persistContractDraftPdf(contract.id, pdfBytes);
  await supabase
    .from('contracts')
    .update({ pdf_storage_path: draftStoragePath, drafted_at })
    .eq('id', contractId);

  const storedPlan = parseStoredRevisionPlan(contract.revision_plan);
  await insertContractAudit(supabase, {
    contract_id: contractId,
    actor_email: actorEmail,
    action: 'contract_amendments_applied',
    metadata: {
      reason: body.reason,
      change_request: changeRequest || undefined,
      revision_plan: storedPlan ?? undefined,
      replaced_existing_edits: Boolean(body.replace_existing_edits),
    },
  });
  revalidateContractPaths(contractId);

  return { plan: storedPlan, previewLines: storedPlan ? revisionPlanToDisplayLines(storedPlan) : [] };
}
