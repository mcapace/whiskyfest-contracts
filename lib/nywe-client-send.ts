import { fetchContractBoothBrandsOrdered } from '@/lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import {
  contractDocuSignEmailBlurb,
  contractDocuSignEmailSubject,
  contractDocuSignFileName,
  contractPdfBaseName,
} from '@/lib/contract-document-naming';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { insertContractAudit } from '@/lib/audit-log';
import { eventTemplateProfile, eventUsesContractOrderTable, isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { persistContractDraftPdf } from '@/lib/contract-pdf-storage';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { requiresDiscountApproval } from '@/lib/contracts';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { sendEnvelope } from '@/lib/docusign';
import { parseSignerCc, validateSignerCcDistinct } from '@/lib/docusign-signer-cc';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { buildContractMergeMap } from '@/lib/merge-map';
import {
  contractHasBillingInfo,
  contractHasNyweLicenseAddress,
  nyweLicenseAddressError,
} from '@/lib/nywe-billing';
import { refreshNyweBillingFromRosterForContract } from '@/lib/nywe-roster-billing-sync';
import { docusignBrandIdForEvent } from '@/lib/product-email';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { syncExhibitorRosterWritebackById } from '@/lib/exhibitor-roster-sync-hook';
import type { ContractStatus, ContractWithTotals, Event } from '@/types/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NYWE_CLIENT_SEND_STATUSES, nyweContractReadyForClientSend } from '@/lib/nywe-client-send-eligibility';

export { NYWE_CLIENT_SEND_STATUSES, nyweContractReadyForClientSend };

export type NyweClientSendResult =
  | { ok: true; envelopeId: string; exhibitorSignerEmail: string }
  | { ok: false; error: string; statusCode?: number };

/** Auto-approve (roster pre-approved) and send one NYWE license to DocuSign. */
export async function nyweClientSendContract(options: {
  supabase: SupabaseClient;
  contractId: string;
  actorEmail: string;
}): Promise<NyweClientSendResult> {
  const { supabase, contractId, actorEmail } = options;

  let contract = await fetchContractWithTotalsById(supabase, contractId);
  if (!contract) {
    return { ok: false, error: 'License not found', statusCode: 404 };
  }

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) {
    return { ok: false, error: 'Event not found', statusCode: 404 };
  }

  if (!isNyweEventsManagedEvent(event)) {
    return { ok: false, error: 'Bulk client send is only available for NYWE roster licenses.', statusCode: 403 };
  }

  if (event.client_send_enabled === false) {
    return { ok: false, error: 'Client send is disabled for this event.', statusCode: 403 };
  }

  if (!nyweContractReadyForClientSend(contract.status)) {
    return {
      ok: false,
      error: `License cannot be sent from status "${contract.status}".`,
      statusCode: 409,
    };
  }

  contract = await refreshNyweBillingFromRosterForContract(supabase, contract, event);

  if (requiresDiscountApproval(contract, event)) {
    return { ok: false, error: 'Discount approval required before send.', statusCode: 403 };
  }

  if (!contract.signer_1_email?.trim() || !contract.signer_1_name?.trim()) {
    return { ok: false, error: 'Signer name and email are required.', statusCode: 400 };
  }

  const addressError = nyweLicenseAddressError(event, contract);
  if (addressError) {
    return { ok: false, error: addressError, statusCode: 400 };
  }

  const countersignerEmail = event.shanken_signatory_email?.trim();
  const countersignerName = event.shanken_signatory_name?.trim();
  if (!countersignerEmail || !countersignerName) {
    return { ok: false, error: 'Event countersigner name and email are required.', statusCode: 500 };
  }

  const signerEmail = contract.signer_1_email.trim();
  const signerName = contract.signer_1_name.trim();
  const carbonCopy = parseSignerCc(contract);
  const ccError = validateSignerCcDistinct({
    signerEmail,
    countersignerEmail,
    cc: carbonCopy,
  });
  if (ccError) {
    return { ok: false, error: ccError, statusCode: 400 };
  }

  const fromStatus = contract.status;
  const nowIso = new Date().toISOString();

  if (contract.status !== 'approved' || !contract.events_approved_at) {
    const { error: approveError } = await supabase
      .from('contracts')
      .update({
        status: 'approved',
        approved_at: contract.approved_at ?? nowIso,
        events_submitted_at: contract.events_submitted_at ?? nowIso,
        events_approved_at: nowIso,
        events_approved_by: actorEmail,
        events_approval_reason: 'Bulk send — roster pre-approved',
      })
      .eq('id', contract.id);

    if (approveError) {
      return { ok: false, error: approveError.message, statusCode: 500 };
    }

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actorEmail,
      action: 'events_approved',
      from_status: fromStatus,
      to_status: 'approved',
      metadata: { bulk_preapproved: true, approver: actorEmail },
    });

    contract = { ...contract, status: 'approved', events_approved_at: nowIso };
  }

  const templateDocId = resolveContractTemplateDocId(contract, event);
  const usesOrderTable = eventUsesContractOrderTable(event);

  try {
    const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
    const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);
    const mergeMap = buildContractMergeMap(contract, event, 'docusign', boothBrands);
    const fileName = `${contractPdfBaseName(contract.exhibitor_company_name, event)} (DocuSign)`;

    const pdfBytes = await renderContractPdfFromTemplate(
      templateDocId,
      mergeMap,
      fileName,
      usesOrderTable ? lineItems : undefined,
      {
        includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract),
      },
    );
    const { draftStoragePath, drafted_at } = await persistContractDraftPdf(contract.id, pdfBytes);

    const { envelopeId } = await sendEnvelope({
      pdfBase64: pdfBytes.toString('base64'),
      documentName: contractDocuSignFileName(contract.exhibitor_company_name, event),
      emailSubject: contractDocuSignEmailSubject(contract.exhibitor_company_name, event),
      emailBlurb: contractDocuSignEmailBlurb(contract.exhibitor_company_name, event),
      signer1: { name: signerName, email: signerEmail },
      countersigner: { name: countersignerName, email: countersignerEmail },
      carbonCopy,
      brandId: docusignBrandIdForEvent(event),
      skipExhibitorDataTabs:
        eventTemplateProfile(event) === 'nywe_vendor' &&
        contractHasBillingInfo(contract) &&
        contractHasNyweLicenseAddress(contract),
    });

    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        docusign_envelope_id: envelopeId,
        sent_at: nowIso,
        pdf_storage_path: draftStoragePath,
        drafted_at,
      })
      .eq('id', contract.id);

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actorEmail,
      action: 'status_changed',
      from_status: 'approved',
      to_status: 'sent',
      metadata: { envelope_id: envelopeId, bulk_send: true },
    });
    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actorEmail,
      action: 'pdf_sent',
      metadata: {
        envelope_id: envelopeId,
        envelope_status: 'sent',
        exhibitor_signer: signerEmail,
        signer_cc_email: carbonCopy?.email ?? null,
        countersigner_email: countersignerEmail,
        countersigner_name: countersignerName,
        bulk_send: true,
      },
    });

    revalidateContractPaths(contract.id);
    await syncExhibitorRosterWritebackById(contract.id);

    return { ok: true, envelopeId, exhibitorSignerEmail: signerEmail };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[nyweClientSendContract]', contractId, message);

    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign send error: ${message.slice(0, 500)}`,
      })
      .eq('id', contract.id);

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actorEmail,
      action: 'pdf_send_failed',
      metadata: { error: message.slice(0, 500), bulk_send: true },
    });

    revalidateContractPaths(contract.id);

    return { ok: false, error: message || 'DocuSign send failed', statusCode: 500 };
  }
}
