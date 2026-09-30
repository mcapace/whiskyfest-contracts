import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchContractBoothBrandsOrdered } from '@/lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import { contractPdfBaseName } from '@/lib/contract-document-naming';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { contractUsesOrderTable } from '@/lib/contract-template-profile';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { buildContractMergeMap } from '@/lib/merge-map';
import { renderContractPdfWithReport, type RenderRevisionReport } from '@/lib/google';
import { buildContractRevisionPlan, amendmentsTextForPlan } from '@/lib/contract-revision-plan-service';
import {
  applyRevisionPlanFieldUpdates,
  mergeRevisionPlans,
  parseStoredRevisionPlan,
  revisionPlanToDisplayLines,
  type ContractRevisionPlan,
} from '@/lib/contract-revision-plan';
import type { ReviseAndSendBody } from '@/lib/contract-revision';
import type { ContractWithTotals, Event } from '@/types/db';

export type RevisionPreviewResult = {
  pdf: Buffer;
  plan: ContractRevisionPlan | null;
  previewLines: string[];
  report: RenderRevisionReport;
};

/**
 * Render the contract exactly as "revise and send" would — plan, amendments, field overrides —
 * without voiding, persisting or sending anything. Unmatched edits come back as warnings.
 */
export async function renderContractRevisionPreview(options: {
  contractId: string;
  body: ReviseAndSendBody;
}): Promise<RevisionPreviewResult> {
  const supabase = getSupabaseAdmin();
  const { contractId, body } = options;

  const stored = await fetchContractWithTotalsById(supabase, contractId);
  if (!stored) throw new Error('Contract not found');
  const { data: event } = await supabase.from('events').select('*').eq('id', stored.event_id).single<Event>();
  if (!event) throw new Error('Event not found');

  let plan = body.revision_plan ?? null;
  const changeRequest = body.change_request?.trim() ?? '';
  if (!plan && changeRequest.length >= 10) {
    plan = (
      await buildContractRevisionPlan({
        contract: stored,
        event,
        changeRequest,
        revisionUploadPath: stored.revision_upload_path,
      })
    ).plan;
  }
  const existingPlan = parseStoredRevisionPlan(stored.revision_plan);
  if (plan && existingPlan && !body.replace_existing_edits) plan = mergeRevisionPlans(existingPlan, plan);
  if (!plan && !body.replace_existing_edits) plan = existingPlan;

  // Apply the same record-level overrides the send would, in memory only.
  const overrides: Record<string, unknown> = {};
  if (plan) {
    applyRevisionPlanFieldUpdates(plan, overrides);
    const planAmendments = amendmentsTextForPlan(plan);
    if (planAmendments) overrides.revision_amendments = planAmendments;
  }
  const textKeys = [
    'revision_amendments',
    'exhibitor_notes',
    'signer_1_name',
    'signer_1_email',
    'signer_cc_name',
    'signer_cc_email',
    'signer_2_name',
    'signer_2_title',
    'signer_2_email',
    'exhibitor_legal_name',
    'exhibitor_company_name',
    'brands_poured',
    'billing_address_line1',
    'billing_city',
    'billing_state',
    'billing_zip',
    'billing_country',
  ] as const;
  for (const key of textKeys) {
    const raw = body[key];
    if (raw === undefined) continue;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (key === 'revision_amendments') {
      overrides[key] = trimmed || overrides.revision_amendments || null;
    } else {
      overrides[key] = trimmed || null;
    }
  }

  const contract = { ...stored, ...overrides } as ContractWithTotals;
  const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
  const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);
  const mergeMap = buildContractMergeMap(contract, event, 'draft', boothBrands);
  const templateDocId = resolveContractTemplateDocId(contract, event);
  const usesOrderTable = contractUsesOrderTable(event, contract);

  const { pdf, report } = await renderContractPdfWithReport(
    templateDocId,
    mergeMap,
    `${contractPdfBaseName(contract.exhibitor_company_name, event)} (Preview)`,
    usesOrderTable ? lineItems : undefined,
    {
      includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract),
      revisionPlan: plan,
      strictRevision: false,
    },
  );

  return { pdf, plan, previewLines: plan ? revisionPlanToDisplayLines(plan) : [], report };
}
