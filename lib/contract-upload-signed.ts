import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { persistContractSignedPdf } from '@/lib/contract-pdf-storage';
import { insertContractAudit } from '@/lib/audit-log';
import { sendEnvelope, voidEnvelope, formatDocuSignErrorForUser } from '@/lib/docusign';
import {
  contractDocuSignEmailBlurb,
  contractDocuSignEmailSubject,
  contractDocuSignFileName,
} from '@/lib/contract-document-naming';
import { docusignBrandIdForEvent, sendGridFromForEvent } from '@/lib/product-email';
import { autoReleaseAfterFullySigned } from '@/lib/auto-release-accounting';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import type { ContractStatus, Event } from '@/types/db';

/**
 * A client signed the contract outside DocuSign (printed / e-signed PDF emailed back, often
 * because they needed signatures the envelope did not have). Attach that PDF to the existing
 * contract instead of re-creating it as a legacy import: void the envelope, store the PDF as
 * the signed copy, then either send it to Whisky Advocate for DocuSign countersignature or
 * mark it fully signed and hand it to accounting.
 */
export const UPLOAD_SIGNED_STATUSES: ContractStatus[] = [
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'error',
];

export type UploadSignedCountersign = 'docusign' | 'none';

export async function attachClientSignedPdf(options: {
  supabase: SupabaseClient;
  contractId: string;
  actorEmail: string;
  pdfBytes: Buffer;
  countersign: UploadSignedCountersign;
  note?: string | null;
  reason?: string | null;
}): Promise<{ status: ContractStatus; envelopeId: string | null; released: boolean }> {
  const { supabase, contractId, actorEmail, pdfBytes, countersign } = options;
  const note = options.note?.trim() || null;
  const reason = options.reason?.trim() || 'Client returned a signed PDF outside DocuSign';

  const contract = await fetchContractWithTotalsById(supabase, contractId);
  if (!contract) throw new Error('Contract not found');
  if (!UPLOAD_SIGNED_STATUSES.includes(contract.status)) {
    throw new Error(`A signed PDF cannot be attached to a ${contract.status} contract.`);
  }
  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) throw new Error('Event not found');

  const priorStatus = contract.status;
  const priorEnvelopeId = contract.docusign_envelope_id?.trim() || null;

  // 1. The DocuSign envelope, if any, is superseded by the client's own signed copy.
  if (priorEnvelopeId) {
    try {
      await voidEnvelope(priorEnvelopeId, `Client signed outside DocuSign — ${actorEmail}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/voided|declined|completed|complete/i.test(msg)) {
        throw new Error(formatDocuSignErrorForUser(msg) || msg);
      }
    }
  }

  // 2. Store the client-signed PDF as this contract's signed copy.
  const { signedStoragePath } = await persistContractSignedPdf(contract.id, pdfBytes);

  const nowIso = new Date().toISOString();
  const stamp = `[${nowIso.slice(0, 10)}] ${actorEmail}: client-signed PDF attached${note ? ` — ${note}` : ''}`;
  const notesPatch: Record<string, unknown> = {};
  if (note) {
    notesPatch.notes = contract.notes?.trim() ? `${contract.notes.trim()}\n${note}` : note;
    notesPatch.accounting_notes = contract.accounting_notes?.trim()
      ? `${contract.accounting_notes.trim()}\n${stamp}`
      : stamp;
  }

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: actorEmail,
    action: 'client_signed_pdf_attached',
    metadata: {
      reason,
      note: note ?? undefined,
      previous_status: priorStatus,
      voided_envelope_id: priorEnvelopeId ?? undefined,
      countersign,
      storage_path: signedStoragePath,
    },
  });

  if (countersign === 'docusign') {
    // 3a. Whisky Advocate countersigns the client's PDF in DocuSign. Single recipient on the
    // countersigner anchors; if the anchor text is not detectable on the scanned/flattened PDF,
    // DocuSign lets the countersigner place their signature field.
    const signatoryEmail = event.shanken_signatory_email?.trim();
    const signatoryName = event.shanken_signatory_name?.trim();
    if (!signatoryEmail || !signatoryName) {
      throw new Error('Event countersigner name and email are required to send for countersignature.');
    }
    let envelopeId: string;
    try {
      const sent = await sendEnvelope({
        pdfBase64: pdfBytes.toString('base64'),
        documentName: contractDocuSignFileName(contract.exhibitor_company_name, event),
        emailSubject: `Countersign: ${contractDocuSignEmailSubject(contract.exhibitor_company_name, event)}`,
        emailBlurb: `${contract.exhibitor_company_name} signed this contract outside DocuSign. ${contractDocuSignEmailBlurb(contract.exhibitor_company_name, event)}`,
        signer1: { name: signatoryName, email: signatoryEmail },
        signer1TabAnchors: 'countersigner',
        skipExhibitorDataTabs: true,
        brandId: docusignBrandIdForEvent(event),
        replyTo: sendGridFromForEvent(event),
      });
      envelopeId = sent.envelopeId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(formatDocuSignErrorForUser(msg) || msg);
    }

    const { error } = await supabase
      .from('contracts')
      .update({
        status: 'partially_signed',
        docusign_envelope_id: envelopeId,
        sent_at: nowIso,
        pdf_storage_path: signedStoragePath,
        signed_pdf_url: null,
        exhibitor_fields_captured_at: contract.exhibitor_fields_captured_at ?? nowIso,
        ...notesPatch,
      })
      .eq('id', contract.id);
    if (error) throw new Error(error.message);

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: actorEmail,
      action: 'status_changed',
      from_status: priorStatus,
      to_status: 'partially_signed',
      metadata: { envelope_id: envelopeId, countersign_only: true, client_signed_pdf: true },
    });
    revalidateContractPaths(contract.id);
    try {
      await syncExhibitorRosterWriteback({ ...contract, status: 'partially_signed', updated_at: nowIso });
    } catch (err) {
      console.error('[upload-signed] roster writeback failed', err);
    }
    return { status: 'partially_signed', envelopeId, released: false };
  }

  // 3b. Fully signed as delivered (both parties on the PDF, or Whisky Advocate signs on paper).
  const { error } = await supabase
    .from('contracts')
    .update({
      status: 'signed',
      docusign_envelope_id: null,
      signed_at: nowIso,
      originally_signed_at: contract.originally_signed_at ?? nowIso,
      pdf_storage_path: signedStoragePath,
      signed_pdf_url: null,
      exhibitor_fields_captured_at: contract.exhibitor_fields_captured_at ?? nowIso,
      ...notesPatch,
    })
    .eq('id', contract.id);
  if (error) throw new Error(error.message);

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: actorEmail,
    action: 'status_changed',
    from_status: priorStatus,
    to_status: 'signed',
    metadata: { client_signed_pdf: true, countersign: 'none' },
  });

  let released = false;
  try {
    const result = await autoReleaseAfterFullySigned({
      supabase,
      contractId: contract.id,
      event,
      countersignerEmail: null,
      actorEmail,
    });
    released = result.released;
  } catch (err) {
    console.error('[upload-signed] auto-release failed', err);
  }
  revalidateContractPaths(contract.id);
  try {
    await syncExhibitorRosterWriteback({ ...contract, status: released ? 'executed' : 'signed', updated_at: nowIso });
  } catch (err) {
    console.error('[upload-signed] roster writeback failed', err);
  }
  return { status: released ? 'executed' : 'signed', envelopeId: null, released };
}
