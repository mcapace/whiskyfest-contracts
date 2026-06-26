import type { SupabaseClient } from '@supabase/supabase-js';
import {
  downloadCompletedPdf,
  extractCountersignerFromSigners,
  fetchEnvelopeSigners,
  fetchEnvelopeStatus,
  fetchRecipientTextTabs,
  type DocuSignSignerRow,
} from '@/lib/docusign';
import { buildExhibitorCaptureDbPatch, textTabsToLabelMap } from '@/lib/docusign-exhibitor-capture';
import { uploadPdfBufferToFolder } from '@/lib/google';
import { contractSignedPdfPath, uploadContractPdfToStorage } from '@/lib/contract-pdf-storage';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { appendContractRow, updateContractRow } from '@/lib/sheets-tracker';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { insertContractAudit } from '@/lib/audit-log';
import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { autoReleaseNyweAfterCountersign } from '@/lib/nywe-auto-release-accounting';
import {
  notifyContractFullySigned,
  notifyPartialSignature,
} from '@/lib/notifications';
import type { ContractWithTotals, Event } from '@/types/db';

function signerCompleted(s: DocuSignSignerRow): boolean {
  const st = (s.status ?? '').toLowerCase();
  return st === 'completed' || st === 'signed';
}

function routing1Signer(signers: DocuSignSignerRow[]): DocuSignSignerRow | undefined {
  return signers.find((s) => s.routingOrder === '1') ?? signers[0];
}

function routing2Signer(signers: DocuSignSignerRow[]): DocuSignSignerRow | undefined {
  return signers.find((s) => s.routingOrder === '2');
}

/** True when DocuSign shows all required signatures (envelope completed or both routing orders done). */
export function isDocuSignEnvelopeFullySigned(
  envelopeStatus: string,
  signers: DocuSignSignerRow[],
): boolean {
  const envLower = envelopeStatus.toLowerCase();
  if (envLower === 'voided' || envLower === 'declined') return false;
  const r1 = routing1Signer(signers);
  const r2 = routing2Signer(signers);
  const r1Done = r1 ? signerCompleted(r1) : false;
  const r2Done = r2 ? signerCompleted(r2) : false;
  const allSignersDone = signers.length > 0 && signers.every(signerCompleted);
  return envLower === 'completed' || allSignersDone || (r1Done && r2Done);
}

export type DocuSignSyncResult =
  | { ok: true; changed: false; message: string; status: string }
  | { ok: true; changed: true; fromStatus: string; toStatus: string; message: string }
  | { ok: false; error: string };

/** Persist exhibitor DocuSign tabs and move contract to partially_signed. */
export async function applyExhibitorPartialSignature(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  event: Event | null,
  envelopeId: string,
  options?: { notify?: boolean; actorEmail?: string | null },
): Promise<{ updated: boolean }> {
  if (contract.status !== 'sent') {
    return { updated: false };
  }

  let exhibitorCapture: ReturnType<typeof buildExhibitorCaptureDbPatch> = null;
  try {
    const signers = await fetchEnvelopeSigners(envelopeId);
    const exhibitorRecipientId = routing1Signer(signers)?.recipientId?.trim() || '1';
    const tabs = await fetchRecipientTextTabs(envelopeId, exhibitorRecipientId);
    exhibitorCapture = buildExhibitorCaptureDbPatch(textTabsToLabelMap(tabs));
  } catch (e) {
    console.error('[docusign-sync] exhibitor tabs fetch failed', {
      contractId: contract.id,
      envelopeId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const { error: partialUpdateErr } = await supabase
    .from('contracts')
    .update({
      status: 'partially_signed',
      ...(exhibitorCapture ?? {}),
    })
    .eq('id', contract.id);

  if (partialUpdateErr) {
    throw new Error(partialUpdateErr.message);
  }

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: options?.actorEmail ?? null,
    action: 'exhibitor_signed',
    from_status: 'sent',
    to_status: 'partially_signed',
    metadata: { envelope_id: envelopeId, source: options?.actorEmail ? 'manual_sync' : 'webhook' },
  });
  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: options?.actorEmail ?? null,
    action: 'status_changed',
    from_status: 'sent',
    to_status: 'partially_signed',
    metadata: { envelope_id: envelopeId },
  });

  revalidateContractPaths(contract.id);

  const { data: afterPartial } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contract.id)
    .maybeSingle<ContractWithTotals>();

  if (afterPartial) {
    try {
      await appendContractRow(afterPartial);
    } catch (err) {
      console.error('Failed to append to Sheets tracker', err);
    }
    await syncExhibitorRosterWriteback(afterPartial);
  }

  if (options?.notify !== false) {
    if (!event || !isNyweEventsManagedEvent(event)) {
      void notifyPartialSignature(contract, event).catch((err) =>
        console.error('[notifyPartialSignature]', err),
      );
    }
  }

  return { updated: true };
}

/** Download signed PDF, store artifacts, set status signed. */
export async function applyEnvelopeFullySigned(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  event: Event | null,
  envelopeId: string,
  options?: { notify?: boolean; actorEmail?: string | null },
): Promise<{ updated: boolean }> {
  if (contract.status === 'executed') {
    return { updated: false };
  }

  if (contract.status === 'signed') {
    if (event && isNyweEventsManagedEvent(event)) {
      const retry = await autoReleaseNyweAfterCountersign({
        supabase,
        contractId: contract.id,
        event,
        countersignerEmail: contract.countersigned_by_email,
        actorEmail: options?.actorEmail ?? null,
      });
      return { updated: retry.released };
    }
    return { updated: false };
  }

  let countersigner = null as ReturnType<typeof extractCountersignerFromSigners>;
  try {
    const signers = await fetchEnvelopeSigners(envelopeId);
    countersigner = extractCountersignerFromSigners(signers);
  } catch (recErr) {
    console.error('DocuSign sync: fetchEnvelopeSigners failed', recErr);
  }

  const pdfBytes = await downloadCompletedPdf(envelopeId);
  const signedFolderId = process.env.GOOGLE_SIGNED_FOLDER_ID!;
  const safeName = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
  const year = event?.year ?? new Date().getFullYear();
  const fileBase = `${safeName} — WhiskyFest ${year} Contract (SIGNED)`;

  const { fileId, webViewLink } = await uploadPdfBufferToFolder(pdfBytes, fileBase, signedFolderId);

  const signedStoragePath = contractSignedPdfPath(contract.id);
  await uploadContractPdfToStorage(signedStoragePath, pdfBytes);

  const now = new Date().toISOString();
  const fromStatus = contract.status;

  await supabase
    .from('contracts')
    .update({
      status: 'signed',
      signed_pdf_drive_id: fileId,
      signed_pdf_url: webViewLink,
      pdf_storage_path: signedStoragePath,
      signed_at: now,
      countersigned_by_email: countersigner?.email ?? null,
      countersigned_by_name: countersigner?.name ?? null,
      countersigned_at: countersigner?.signedDateTime ?? null,
    })
    .eq('id', contract.id);

  if (countersigner?.email) {
    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: countersigner.email,
      action: 'countersigner_signed',
      from_status: fromStatus === 'partially_signed' ? 'partially_signed' : fromStatus,
      to_status: 'signed',
      metadata: {
        envelope_id: envelopeId,
        countersigner_name: countersigner.name,
        countersigner_email: countersigner.email,
        signed_at: countersigner.signedDateTime,
      },
    });
  }

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: options?.actorEmail ?? null,
    action: 'docusign_completed',
    from_status: fromStatus,
    to_status: 'signed',
    metadata: {
      envelope_id: envelopeId,
      signed_pdf_url: webViewLink,
      release_required: !(event && isNyweEventsManagedEvent(event)),
      countersigned_by_email: countersigner?.email ?? null,
      countersigned_by_name: countersigner?.name ?? null,
      source: options?.actorEmail ? 'manual_sync' : 'webhook',
    },
  });
  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: options?.actorEmail ?? null,
    action: 'status_changed',
    from_status: fromStatus,
    to_status: 'signed',
    metadata: { envelope_id: envelopeId },
  });

  revalidateContractPaths(contract.id);

  const { data: afterSigned } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contract.id)
    .maybeSingle<ContractWithTotals>();

  if (afterSigned) {
    try {
      await updateContractRow(afterSigned);
    } catch (err) {
      console.error('Failed to update Sheets tracker', err);
    }
    await syncExhibitorRosterWriteback(afterSigned);

    if (event && isNyweEventsManagedEvent(event)) {
      await autoReleaseNyweAfterCountersign({
        supabase,
        contractId: afterSigned.id,
        event,
        countersignerEmail: countersigner?.email ?? afterSigned.countersigned_by_email,
        actorEmail: options?.actorEmail ?? null,
      });
    }
  }

  if (options?.notify !== false) {
    const countersignerDisplayName =
      countersigner?.name?.trim() || event?.shanken_signatory_name?.trim() || 'Countersigner';
    // NYWE: no countersign email — queue on Wine Spectator dashboard instead.
    if (!event || !isNyweEventsManagedEvent(event)) {
      void notifyContractFullySigned(contract, event, countersignerDisplayName).catch((err) =>
        console.error('[notifyContractFullySigned]', err),
      );
    }
  }

  return { updated: true };
}

/**
 * Reconcile contract status with DocuSign (missed Connect webhooks, HMAC failures, etc.).
 */
export async function syncContractFromDocuSign(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  event: Event | null,
  actorEmail?: string | null,
  options?: { notify?: boolean },
): Promise<DocuSignSyncResult> {
  const notify = options?.notify !== false;
  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return { ok: false, error: 'No DocuSign envelope is linked to this contract.' };
  }

  if (contract.status === 'signed') {
    if (event && isNyweEventsManagedEvent(event)) {
      const retry = await autoReleaseNyweAfterCountersign({
        supabase,
        contractId: contract.id,
        event,
        countersignerEmail: contract.countersigned_by_email,
        actorEmail: actorEmail ?? null,
      });
      if (retry.released) {
        return {
          ok: true,
          changed: true,
          fromStatus: 'signed',
          toStatus: 'executed',
          message: 'Released countersigned license to accounting.',
        };
      }
      if (retry.error) {
        return { ok: false, error: retry.error };
      }
    }
    return {
      ok: true,
      changed: false,
      message: 'Contract is already fully signed in the app.',
      status: contract.status,
    };
  }

  if (!['sent', 'partially_signed', 'error'].includes(contract.status)) {
    return {
      ok: true,
      changed: false,
      message: `Contract is already ${contract.status}; nothing to sync.`,
      status: contract.status,
    };
  }

  const { status: envelopeStatus } = await fetchEnvelopeStatus(envelopeId);
  const envLower = envelopeStatus.toLowerCase();
  const signers = await fetchEnvelopeSigners(envelopeId);
  const r1 = routing1Signer(signers);
  const r1Done = r1 ? signerCompleted(r1) : false;

  if (envLower === 'voided' || envLower === 'declined') {
    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign envelope ${envelopeStatus} (synced from DocuSign)`,
      })
      .eq('id', contract.id);
    revalidateContractPaths(contract.id);
    return {
      ok: true,
      changed: true,
      fromStatus: contract.status,
      toStatus: 'error',
      message: `Envelope is ${envelopeStatus} in DocuSign.`,
    };
  }

  if (isDocuSignEnvelopeFullySigned(envelopeStatus, signers)) {
    try {
      const { updated } = await applyEnvelopeFullySigned(supabase, contract, event, envelopeId, {
        actorEmail,
        notify,
      });
      if (!updated) {
        return {
          ok: true,
          changed: false,
          message: 'Contract is already fully signed in the app.',
          status: contract.status,
        };
      }
      return {
        ok: true,
        changed: true,
        fromStatus: contract.status,
        toStatus: 'signed',
        message: 'Synced fully signed contract from DocuSign.',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase
        .from('contracts')
        .update({
          status: 'error',
          notes: `DocuSign sync error: ${msg.slice(0, 500)}`,
        })
        .eq('id', contract.id);
      revalidateContractPaths(contract.id);
      return { ok: false, error: msg };
    }
  }

  if (r1Done && contract.status === 'sent') {
    try {
      await applyExhibitorPartialSignature(supabase, contract, event, envelopeId, {
        actorEmail,
        notify,
      });
      return {
        ok: true,
        changed: true,
        fromStatus: 'sent',
        toStatus: 'partially_signed',
        message: 'Synced exhibitor signature from DocuSign.',
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return {
    ok: true,
    changed: false,
    message: `DocuSign envelope status is "${envelopeStatus}". No app status change needed yet.`,
    status: contract.status,
  };
}
