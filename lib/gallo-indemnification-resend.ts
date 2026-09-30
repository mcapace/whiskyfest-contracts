import { insertContractAudit } from '@/lib/audit-log';
import {
  contractDocuSignEmailBlurb,
  contractDocuSignEmailSubject,
  contractDocuSignFileName,
  contractPdfBaseName,
} from '@/lib/contract-document-naming';
import { persistContractDraftPdf } from '@/lib/contract-pdf-storage';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { fetchContractBoothBrandsOrdered } from '@/lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { contractUsesOrderTable } from '@/lib/contract-template-profile';
import {
  countersignerRequiredForEvent,
  countersignCcValidation,
  resolveDocuSignCountersignDelivery,
  toSendEnvelopeCountersignParams,
} from '@/lib/docusign-envelope-recipients';
import { shouldSkipExhibitorDataTabs } from '@/lib/exhibitor-docusign-fields';
import { formatDocuSignErrorForUser, sendEnvelope, voidEnvelope } from '@/lib/docusign';
import {
  GALLO_COMBINED_CONTRACT_ID,
  GALLO_INDEMNIFICATION_APPLIED_NOTE,
  GALLO_INDEMNIFICATION_PENDING_PREFIX,
} from '@/lib/gallo-mutual-indemnification';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { buildContractMergeMap } from '@/lib/merge-map';
import { nyweLicenseAddressError } from '@/lib/nywe-billing';
import { docusignBrandIdForEvent, sendGridFromForEvent } from '@/lib/product-email';
import { parseSignerCc } from '@/lib/docusign-signer-cc';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractStatus, Event } from '@/types/db';

const ACTOR = 'mcapace@mshanken.com';
const IN_PROGRESS_NOTE = 'gallo-indemnification-in-progress';

export async function pendingGalloIndemnificationToken(): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('contracts')
    .select('notes')
    .eq('id', GALLO_COMBINED_CONTRACT_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const notes = typeof data?.notes === 'string' ? data.notes : '';
  if (!notes.startsWith(GALLO_INDEMNIFICATION_PENDING_PREFIX)) return null;
  const token = notes.slice(GALLO_INDEMNIFICATION_PENDING_PREFIX.length).trim();
  return token || null;
}

/**
 * Void the in-flight Gallo envelope and send a new one whose Section 6 is the
 * approved mutual indemnification. No-ops unless notes still carry the pending marker.
 */
export async function applyPendingGalloMutualIndemnification(): Promise<{
  applied: boolean;
  reason?: string;
  envelopeId?: string;
}> {
  const supabase = getSupabaseAdmin();
  const contract = await fetchContractWithTotalsById(supabase, GALLO_COMBINED_CONTRACT_ID);
  if (!contract) return { applied: false, reason: 'contract_missing' };

  const notes = contract.notes ?? '';
  if (!notes.startsWith(GALLO_INDEMNIFICATION_PENDING_PREFIX)) {
    return { applied: false, reason: 'not_pending' };
  }
  const pendingToken = notes.slice(GALLO_INDEMNIFICATION_PENDING_PREFIX.length).trim();

  const { data: locked, error: lockError } = await supabase
    .from('contracts')
    .update({ notes: IN_PROGRESS_NOTE })
    .eq('id', contract.id)
    .like('notes', `${GALLO_INDEMNIFICATION_PENDING_PREFIX}%`)
    .select('id');
  if (lockError) throw new Error(lockError.message);
  if (!locked?.length) return { applied: false, reason: 'already_running' };

  const restorePending = async () => {
    await supabase
      .from('contracts')
      .update({ notes: `${GALLO_INDEMNIFICATION_PENDING_PREFIX}${pendingToken}` })
      .eq('id', contract.id)
      .eq('notes', IN_PROGRESS_NOTE);
  };

  const blocked: ContractStatus[] = ['signed', 'executed', 'cancelled', 'voided'];
  if (blocked.includes(contract.status) || contract.signed_at) {
    await restorePending();
    return { applied: false, reason: `status_${contract.status}` };
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', contract.event_id)
    .single<Event>();
  if (eventError || !event) {
    await restorePending();
    return { applied: false, reason: 'event_missing' };
  }

  const addressError = nyweLicenseAddressError(event, contract);
  if (addressError) {
    await restorePending();
    throw new Error(addressError);
  }
  if (!contract.signer_1_name?.trim() || !contract.signer_1_email?.trim()) {
    await restorePending();
    throw new Error('Signer name and email are required.');
  }

  const countersignDelivery = await resolveDocuSignCountersignDelivery(event);
  if (countersignerRequiredForEvent(event) && !countersignDelivery) {
    await restorePending();
    throw new Error('Event countersigner name and email are required.');
  }
  const ccError = countersignCcValidation({
    signerEmail: contract.signer_1_email.trim(),
    delivery: countersignDelivery,
    cc: parseSignerCc(contract),
  });
  if (ccError) {
    await restorePending();
    throw new Error(ccError);
  }

  const priorStatus = contract.status;
  const priorEnvelopeId = contract.docusign_envelope_id?.trim() || null;
  if (priorEnvelopeId && (priorStatus === 'sent' || priorStatus === 'partially_signed')) {
    try {
      await voidEnvelope(
        priorEnvelopeId,
        'Replacing Section 6 with the mutual indemnification approved by Lon Gallagher',
      );
    } catch (err) {
      console.error('[gallo-indemnification] void failed, continuing', err);
    }
    const { error: clearError } = await supabase
      .from('contracts')
      .update({
        status: 'approved',
        docusign_envelope_id: null,
        sent_at: null,
      })
      .eq('id', contract.id);
    if (clearError) {
      await restorePending();
      throw new Error(clearError.message);
    }
  }

  const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
  const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);
  const mergeMap = buildContractMergeMap(contract, event, 'docusign', boothBrands);
  const usesOrderTable = contractUsesOrderTable(event, contract);
  let pdfBytes: Buffer;
  let draftStoragePath: string;
  let drafted_at: string;
  let envelopeId: string;
  try {
    pdfBytes = await renderContractPdfFromTemplate(
      resolveContractTemplateDocId(contract, event),
      mergeMap,
      `${contractPdfBaseName(contract.exhibitor_company_name, event)} (Gallo indemnification)`,
      usesOrderTable ? lineItems : undefined,
      { includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract) },
    );
    const persisted = await persistContractDraftPdf(contract.id, pdfBytes);
    draftStoragePath = persisted.draftStoragePath;
    drafted_at = persisted.drafted_at;
    const sent = await sendEnvelope({
      pdfBase64: pdfBytes.toString('base64'),
      documentName: contractDocuSignFileName(contract.exhibitor_company_name, event),
      emailSubject: contractDocuSignEmailSubject(contract.exhibitor_company_name, event),
      emailBlurb: contractDocuSignEmailBlurb(contract.exhibitor_company_name, event),
      signer1: { name: contract.signer_1_name.trim(), email: contract.signer_1_email.trim() },
      ...toSendEnvelopeCountersignParams(countersignDelivery),
      carbonCopy: parseSignerCc(contract),
      brandId: docusignBrandIdForEvent(event),
      replyTo: sendGridFromForEvent(event),
      skipExhibitorDataTabs: shouldSkipExhibitorDataTabs(event, contract),
    });
    envelopeId = sent.envelopeId;
  } catch (err) {
    await restorePending();
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(formatDocuSignErrorForUser(msg));
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'sent',
      docusign_envelope_id: envelopeId,
      sent_at: sentAt,
      pdf_storage_path: draftStoragePath,
      drafted_at,
      notes: GALLO_INDEMNIFICATION_APPLIED_NOTE,
    })
    .eq('id', contract.id);
  if (updateError) throw new Error(updateError.message);

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: ACTOR,
    action: 'contract_revised_and_resent',
    from_status: priorStatus,
    to_status: 'sent',
    metadata: {
      reason:
        'Gallo / Lon Gallagher approved mutual indemnification — applied to the combined $70,000 NYWE license. All other terms unchanged.',
      old_envelope_id: priorEnvelopeId,
      new_envelope_id: envelopeId,
      indemnification: 'mutual_gallo_approved',
    },
  });

  return { applied: true, envelopeId };
}
