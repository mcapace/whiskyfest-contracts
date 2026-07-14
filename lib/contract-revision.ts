import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';
import { clearedRepEnteredBilling } from '@/lib/contract-schemas';
import { voidEnvelope, sendEnvelope, formatDocuSignErrorForUser } from '@/lib/docusign';
import { renderContractPdfFromTemplate } from '@/lib/google';
import {
  contractRevisionUploadPath,
  downloadContractPdfFromStorage,
  persistContractDraftPdf,
} from '@/lib/contract-pdf-storage';
import { fetchContractBoothBrandsOrdered } from '@/lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import {
  contractDocuSignEmailBlurb,
  contractDocuSignEmailSubject,
  contractDocuSignFileName,
  contractPdfBaseName,
} from '@/lib/contract-document-naming';
import { eventUsesContractOrderTable } from '@/lib/contract-template-profile';
import {
  countersignerRequiredForEvent,
  docusignCountersignerForEvent,
} from '@/lib/docusign-envelope-recipients';
import { shouldSkipExhibitorDataTabs } from '@/lib/exhibitor-docusign-fields';
import { nyweLicenseAddressError } from '@/lib/nywe-billing';
import { refreshNyweBillingFromRosterForContract } from '@/lib/nywe-roster-billing-sync';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { buildContractMergeMap } from '@/lib/merge-map';
import { requiresDiscountApproval } from '@/lib/contracts';
import { insertContractAudit } from '@/lib/audit-log';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { docusignBrandIdForEvent } from '@/lib/product-email';
import { parseSignerCc, validateSignerCcDistinct } from '@/lib/docusign-signer-cc';
import {
  amendmentsTextForPlan,
  buildContractRevisionPlan,
  docRequestsForRevisionPlan,
} from '@/lib/contract-revision-plan-service';
import {
  applyRevisionPlanFieldUpdates,
  contractRevisionPlanSchema,
  type ContractRevisionPlan,
} from '@/lib/contract-revision-plan';
import type { Contract, ContractStatus, ContractWithTotals, Event } from '@/types/db';

export const reviseAndSendBodySchema = z.object({
  reason: z.string().trim().min(10).max(1000),
  use_uploaded_pdf: z.boolean().optional(),
  /** Natural-language client change requests (parsed by AI into template edits). */
  change_request: z.string().max(50000).optional().nullable(),
  /** Pre-computed plan from POST /revision-plan; generated on submit if omitted. */
  revision_plan: contractRevisionPlanSchema.optional().nullable(),
  revision_amendments: z.string().max(50000).optional().nullable(),
  exhibitor_notes: z.string().max(50000).optional().nullable(),
  signer_1_name: z.string().trim().min(1).optional(),
  signer_1_email: z.string().trim().email().optional(),
  signer_cc_name: z.string().max(200).optional().nullable(),
  signer_cc_email: z.string().email().optional().or(z.literal('')).nullable(),
  exhibitor_legal_name: z.string().trim().min(1).optional(),
  exhibitor_company_name: z.string().trim().min(1).optional(),
  brands_poured: z.string().max(2000).optional().nullable(),
  billing_address_line1: z.string().max(500).optional().nullable(),
  billing_city: z.string().max(200).optional().nullable(),
  billing_state: z.string().max(100).optional().nullable(),
  billing_zip: z.string().max(50).optional().nullable(),
  billing_country: z.string().max(100).optional().nullable(),
});

export type ReviseAndSendBody = z.infer<typeof reviseAndSendBodySchema>;

const IN_FLIGHT: ContractStatus[] = ['sent', 'partially_signed'];

async function recallInFlightContract(
  contract: Contract,
  actorEmail: string,
  reason: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const oldEnvelopeId = contract.docusign_envelope_id?.trim();
  if (oldEnvelopeId) {
    try {
      await voidEnvelope(oldEnvelopeId, `Client revisions — ${reason.slice(0, 800)}`);
    } catch (e) {
      console.error('[recallInFlightContract] void failed, continuing', e);
    }
  }

  const { error } = await supabase
    .from('contracts')
    .update({
      status: 'draft',
      docusign_envelope_id: null,
      sent_at: null,
      signed_at: null,
      countersigned_at: null,
      countersigned_by_email: null,
      countersigned_by_name: null,
      executed_at: null,
      billing_contact_name: null,
      billing_contact_email: null,
      event_contact_name: null,
      event_contact_email: null,
      exhibitor_fields_captured_at: null,
      ...clearedRepEnteredBilling(),
    })
    .eq('id', contract.id);

  if (error) throw new Error(error.message);

  await supabase.from('audit_log').insert({
    contract_id: contract.id,
    actor_email: actorEmail,
    action: 'contract_recalled_to_draft',
    from_status: contract.status,
    to_status: 'draft',
    metadata: { old_envelope_id: oldEnvelopeId, reason, source: 'revise_and_send' },
  });
}

function buildRevisionPatch(
  body: ReviseAndSendBody,
  contract: Contract,
  plan?: ContractRevisionPlan | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    revision_round: (contract.revision_round ?? 0) + 1,
    revision_use_uploaded_pdf: Boolean(body.use_uploaded_pdf),
  };

  if (plan) {
    applyRevisionPlanFieldUpdates(plan, patch);
    const planAmendments = amendmentsTextForPlan(plan);
    if (planAmendments) patch.revision_amendments = planAmendments;
  }

  const set = (key: string, value: unknown) => {
    if (value !== undefined) patch[key] = value;
  };

  set('revision_amendments', body.revision_amendments?.trim() || patch.revision_amendments || null);
  set('exhibitor_notes', body.exhibitor_notes?.trim() || null);
  set('signer_1_name', body.signer_1_name?.trim());
  set('signer_1_email', body.signer_1_email?.trim());
  set('signer_cc_name', body.signer_cc_name?.trim() || null);
  set('signer_cc_email', body.signer_cc_email?.trim() || null);
  set('exhibitor_legal_name', body.exhibitor_legal_name?.trim());
  set('exhibitor_company_name', body.exhibitor_company_name?.trim());
  set('brands_poured', body.brands_poured?.trim() || null);
  set('billing_address_line1', body.billing_address_line1?.trim() || null);
  set('billing_city', body.billing_city?.trim() || null);
  set('billing_state', body.billing_state?.trim() || null);
  set('billing_zip', body.billing_zip?.trim() || null);
  set('billing_country', body.billing_country?.trim() || null);

  return patch;
}

async function resolveRevisionPdfBytes(
  contract: ContractWithTotals,
  event: Event,
  plan?: ContractRevisionPlan | null,
): Promise<Buffer> {
  if (contract.revision_use_uploaded_pdf && contract.revision_upload_path?.trim()) {
    return downloadContractPdfFromStorage(contract.revision_upload_path.trim());
  }

  const supabase = getSupabaseAdmin();
  const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
  const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);
  const mergeMap = buildContractMergeMap(contract, event, 'docusign', boothBrands);
  const templateDocId = resolveContractTemplateDocId(contract, event);
  const usesOrderTable = eventUsesContractOrderTable(event);
  const postMergeRevisionRequests = plan ? docRequestsForRevisionPlan(plan) : undefined;

  return renderContractPdfFromTemplate(
    templateDocId,
    mergeMap,
    `${contractPdfBaseName(contract.exhibitor_company_name, event)} (Revision)`,
    usesOrderTable ? lineItems : undefined,
    {
      includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract),
      postMergeRevisionRequests,
    },
  );
}

export async function reviseAndSendContract(options: {
  contractId: string;
  actorEmail: string;
  body: ReviseAndSendBody;
}): Promise<{ envelopeId: string; revisionRound: number }> {
  const supabase = getSupabaseAdmin();
  const { contractId, actorEmail, body } = options;

  let contract = await fetchContractWithTotalsById(supabase, contractId);
  if (!contract) throw new Error('Contract not found');

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) throw new Error('Event not found');

  if (event.client_send_enabled === false) {
    throw new Error('Client send is disabled for this event.');
  }

  if (!IN_FLIGHT.includes(contract.status)) {
    throw new Error('Revise and send is only available while the contract is sent or partially signed.');
  }

  const priorStatus = contract.status;
  const priorEnvelopeId = contract.docusign_envelope_id;

  let revisionPlan = body.revision_plan ?? null;
  const changeRequest = body.change_request?.trim() ?? '';
  if (!body.use_uploaded_pdf && !revisionPlan && changeRequest.length >= 10) {
    const built = await buildContractRevisionPlan({
      contract,
      event,
      changeRequest,
      revisionUploadPath: contract.revision_upload_path,
    });
    revisionPlan = built.plan;
  }

  await recallInFlightContract(contract, actorEmail, body.reason);

  const patch = buildRevisionPatch(body, contract, revisionPlan);
  const { error: patchError } = await supabase.from('contracts').update(patch).eq('id', contractId);
  if (patchError) throw new Error(patchError.message);

  contract = (await fetchContractWithTotalsById(supabase, contractId))!;
  contract = await refreshNyweBillingFromRosterForContract(supabase, contract, event);

  if (requiresDiscountApproval(contract, event)) {
    throw new Error('Discount approval required before resending.');
  }

  if (!contract.signer_1_name?.trim() || !contract.signer_1_email?.trim()) {
    throw new Error('Signer name and email are required.');
  }

  const addressError = nyweLicenseAddressError(event, contract);
  if (addressError) throw new Error(addressError);

  if (contract.revision_use_uploaded_pdf && !contract.revision_upload_path?.trim()) {
    throw new Error('Upload a redlined PDF first, or uncheck “Send uploaded document”.');
  }

  const countersigner = docusignCountersignerForEvent(event);
  if (countersignerRequiredForEvent(event) && !countersigner) {
    throw new Error('Event countersigner name and email are required.');
  }

  const signerEmail = contract.signer_1_email.trim();
  const signerName = contract.signer_1_name.trim();
  const carbonCopy = parseSignerCc(contract);
  const ccError = validateSignerCcDistinct({
    signerEmail,
    countersignerEmail: countersigner?.email ?? event.shanken_signatory_email?.trim() ?? '',
    cc: carbonCopy,
  });
  if (ccError) throw new Error(ccError);

  const pdfBytes = await resolveRevisionPdfBytes(contract, event, revisionPlan);
  const { draftStoragePath, drafted_at } = await persistContractDraftPdf(contract.id, pdfBytes);

  const now = new Date().toISOString();
  const { error: approveError } = await supabase
    .from('contracts')
    .update({
      status: 'approved',
      events_approved_at: now,
      events_approved_by: actorEmail,
      events_approval_reason: `Revision round ${contract.revision_round}: ${body.reason.slice(0, 500)}`,
      approved_at: now,
      pdf_storage_path: draftStoragePath,
      drafted_at,
    })
    .eq('id', contractId);
  if (approveError) throw new Error(approveError.message);

  contract = (await fetchContractWithTotalsById(supabase, contractId))!;

  let envelopeId: string;
  try {
    const sent = await sendEnvelope({
      pdfBase64: pdfBytes.toString('base64'),
      documentName: contractDocuSignFileName(contract.exhibitor_company_name, event),
      emailSubject: contractDocuSignEmailSubject(contract.exhibitor_company_name, event),
      emailBlurb: contractDocuSignEmailBlurb(contract.exhibitor_company_name, event),
      signer1: { name: signerName, email: signerEmail },
      countersigner,
      carbonCopy,
      brandId: docusignBrandIdForEvent(event),
      skipExhibitorDataTabs: shouldSkipExhibitorDataTabs(event, contract),
    });
    envelopeId = sent.envelopeId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(formatDocuSignErrorForUser(msg));
  }

  const { error: sendUpdateError } = await supabase
    .from('contracts')
    .update({
      status: 'sent',
      docusign_envelope_id: envelopeId,
      sent_at: new Date().toISOString(),
    })
    .eq('id', contractId);
  if (sendUpdateError) throw new Error(sendUpdateError.message);

  await insertContractAudit(supabase, {
    contract_id: contractId,
    actor_email: actorEmail,
    action: 'contract_revised_and_resent',
    from_status: priorStatus,
    to_status: 'sent',
    metadata: {
      reason: body.reason,
      change_request: changeRequest || undefined,
      revision_plan: revisionPlan ?? undefined,
      revision_round: contract.revision_round,
      old_envelope_id: priorEnvelopeId,
      new_envelope_id: envelopeId,
      used_uploaded_pdf: contract.revision_use_uploaded_pdf,
    },
  });

  const withTotals = await fetchContractWithTotalsById(supabase, contractId);
  if (withTotals) {
    try {
      await syncExhibitorRosterWriteback(withTotals);
    } catch (err) {
      console.error('[reviseAndSend] roster writeback failed', err);
    }
  }

  return { envelopeId, revisionRound: contract.revision_round };
}

export async function storeRevisionUpload(contractId: string, pdfBytes: Buffer): Promise<string> {
  const path = contractRevisionUploadPath(contractId);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from('contract-pdfs')
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(error.message);

  const { error: updateError } = await supabase
    .from('contracts')
    .update({ revision_upload_path: path })
    .eq('id', contractId);
  if (updateError) throw new Error(updateError.message);

  return path;
}
