import type { SupabaseClient } from '@supabase/supabase-js';
import {
  downloadCompletedPdf,
  extractCountersignerFromSigners,
  fetchEnvelopeSigners,
  fetchEnvelopeStatus,
  type DocuSignSignerRow,
} from '@/lib/docusign';
import {
  fetchExhibitorCaptureFromEnvelope,
  type ExhibitorCaptureDbRow,
} from '@/lib/docusign-exhibitor-capture';
import { uploadPdfBufferToFolder } from '@/lib/google';
import { signedFolderIdForEvent } from '@/lib/google-drive-folders';
import { contractPdfBaseName } from '@/lib/contract-document-naming';
import { contractSignedPdfPath, uploadContractPdfToStorage } from '@/lib/contract-pdf-storage';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { appendContractRow, updateContractRow } from '@/lib/sheets-tracker';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { insertContractAudit } from '@/lib/audit-log';
import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { autoReleaseAfterFullySigned } from '@/lib/auto-release-accounting';
import { eventCountersignerIdentity } from '@/lib/docusign-envelope-recipients';
import { docuSignPollEligible, touchDocuSignPoll } from '@/lib/docusign-poll-cooldown';
import { usesSingleSignerEnvelope } from '@/lib/single-signer-envelope';
import {
  notifyContractFullySigned,
  notifyPartialSignature,
} from '@/lib/notifications';
import type { ContractWithTotals, Event } from '@/types/db';

export { fetchExhibitorCaptureFromEnvelope } from '@/lib/docusign-exhibitor-capture';

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
  options?: {
    /**
     * Legacy single-signer envelopes: exhibitor completion is enough even if a
     * leftover routing-order-2 recipient is still pending in DocuSign.
     */
    exhibitorCompleteIsFull?: boolean;
  },
): boolean {
  const envLower = envelopeStatus.toLowerCase();
  if (envLower === 'voided' || envLower === 'declined') return false;
  const r1 = routing1Signer(signers);
  const r2 = routing2Signer(signers);
  const r1Done = r1 ? signerCompleted(r1) : false;
  const r2Done = r2 ? signerCompleted(r2) : false;
  const allSignersDone = signers.length > 0 && signers.every(signerCompleted);
  if (options?.exhibitorCompleteIsFull && r1Done) return true;
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

  const exhibitorCapture = await fetchExhibitorCaptureFromEnvelope(envelopeId);

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

/**
 * Already executed (e.g. NYWE custom PDF missing WS signature): replace the stored
 * signed PDF when a later countersign envelope completes. Do not re-release to AR.
 */
export async function replaceExecutedSignedPdfFromEnvelope(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  event: Event | null,
  envelopeId: string,
  options?: { actorEmail?: string | null },
): Promise<{ updated: boolean }> {
  if (contract.status !== 'executed') return { updated: false };

  const signers = await fetchEnvelopeSigners(envelopeId);
  const r1 = routing1Signer(signers);
  const countersigner =
    extractCountersignerFromSigners(signers) ??
    (r1?.email && (r1.status ?? '').toLowerCase().match(/completed|signed/)
      ? {
          email: r1.email.trim(),
          name: (r1.name ?? r1.email).trim(),
          signedDateTime: r1.signedDateTime ?? new Date().toISOString(),
        }
      : event
        ? eventCountersignerIdentity(event, new Date().toISOString())
        : null);

  const pdfBytes = await downloadCompletedPdf(envelopeId);
  const signedFolderId = signedFolderIdForEvent(event);
  const fileBase = event
    ? `${contractPdfBaseName(contract.exhibitor_company_name, event)} (SIGNED)`
    : `${contract.exhibitor_company_name.replace(/[^\w\s-]/g, '')} — Contract (SIGNED)`;

  const { fileId, webViewLink } = await uploadPdfBufferToFolder(pdfBytes, fileBase, signedFolderId);
  const signedStoragePath = contractSignedPdfPath(contract.id);
  await uploadContractPdfToStorage(signedStoragePath, pdfBytes);

  await supabase
    .from('contracts')
    .update({
      signed_pdf_drive_id: fileId,
      signed_pdf_url: webViewLink,
      pdf_storage_path: signedStoragePath,
      countersigned_by_email: countersigner?.email ?? contract.countersigned_by_email,
      countersigned_by_name: countersigner?.name ?? contract.countersigned_by_name,
      countersigned_at: countersigner?.signedDateTime ?? contract.countersigned_at,
    })
    .eq('id', contract.id);

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: options?.actorEmail ?? countersigner?.email ?? null,
    action: 'countersigner_signed',
    from_status: 'executed',
    to_status: 'executed',
    metadata: {
      envelope_id: envelopeId,
      source: 'executed_pdf_refresh',
      countersigner_name: countersigner?.name ?? null,
      countersigner_email: countersigner?.email ?? null,
      signed_pdf_url: webViewLink,
    },
  });

  revalidateContractPaths(contract.id);
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
    return replaceExecutedSignedPdfFromEnvelope(supabase, contract, event, envelopeId, options);
  }

  if (contract.status === 'signed') {
    if (event) {
      const retry = await autoReleaseAfterFullySigned({
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

  let signers: DocuSignSignerRow[] | undefined;
  let countersigner = null as ReturnType<typeof extractCountersignerFromSigners>;
  try {
    signers = await fetchEnvelopeSigners(envelopeId);
    countersigner = extractCountersignerFromSigners(signers);
  } catch (recErr) {
    console.error('DocuSign sync: fetchEnvelopeSigners failed', recErr);
  }

  const now = new Date().toISOString();
  if (!countersigner?.email && event && usesSingleSignerEnvelope(event)) {
    countersigner = eventCountersignerIdentity(event, now);
  }

  // Late capture: envelope-completed can arrive while status is still `sent`, skipping the
  // partially_signed path that normally persists billing tabs. Capture before release/email.
  let lateExhibitorCapture: ExhibitorCaptureDbRow | null = null;
  if (!contract.exhibitor_fields_captured_at) {
    lateExhibitorCapture = await fetchExhibitorCaptureFromEnvelope(envelopeId, signers);
  }

  const pdfBytes = await downloadCompletedPdf(envelopeId);
  const signedFolderId = signedFolderIdForEvent(event);
  const fileBase = event
    ? `${contractPdfBaseName(contract.exhibitor_company_name, event)} (SIGNED)`
    : `${contract.exhibitor_company_name.replace(/[^\w\s-]/g, '')} — Contract (SIGNED)`;

  const { fileId, webViewLink } = await uploadPdfBufferToFolder(pdfBytes, fileBase, signedFolderId);

  const signedStoragePath = contractSignedPdfPath(contract.id);
  await uploadContractPdfToStorage(signedStoragePath, pdfBytes);

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
      ...(lateExhibitorCapture ?? {}),
    })
    .eq('id', contract.id);

  if (lateExhibitorCapture) {
    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: options?.actorEmail ?? null,
      action: 'exhibitor_fields_captured',
      metadata: {
        envelope_id: envelopeId,
        source: 'late_capture_on_fully_signed',
        from_status: fromStatus,
      },
    });
  }

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
      release_required: false,
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

    if (event) {
      await autoReleaseAfterFullySigned({
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
  options?: { notify?: boolean; forcePoll?: boolean },
): Promise<DocuSignSyncResult> {
  const notify = options?.notify !== false;
  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return { ok: false, error: 'No DocuSign envelope is linked to this contract.' };
  }

  if (contract.status === 'signed') {
    if (event) {
      const retry = await autoReleaseAfterFullySigned({
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

  if (contract.status === 'executed') {
    const { status: envelopeStatus } = await fetchEnvelopeStatus(envelopeId);
    const signers = await fetchEnvelopeSigners(envelopeId);
    await touchDocuSignPoll(supabase, contract.id);
    if (
      isDocuSignEnvelopeFullySigned(envelopeStatus, signers, {
        exhibitorCompleteIsFull: false,
      })
    ) {
      const { updated } = await replaceExecutedSignedPdfFromEnvelope(
        supabase,
        contract,
        event,
        envelopeId,
        { actorEmail },
      );
      if (updated) {
        return {
          ok: true,
          changed: true,
          fromStatus: 'executed',
          toStatus: 'executed',
          message: 'Replaced executed PDF with countersigned DocuSign copy.',
        };
      }
    }
    return {
      ok: true,
      changed: false,
      message: `Contract is already ${contract.status}; nothing to sync.`,
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

  if (!options?.forcePoll && !docuSignPollEligible(contract.docusign_last_polled_at)) {
    return {
      ok: true,
      changed: false,
      message: 'DocuSign was checked recently; skipping poll.',
      status: contract.status,
    };
  }

  const { status: envelopeStatus } = await fetchEnvelopeStatus(envelopeId);
  const envLower = envelopeStatus.toLowerCase();
  const signers = await fetchEnvelopeSigners(envelopeId);
  // Touch after a successful DocuSign read so API failures do not burn the cooldown window.
  await touchDocuSignPoll(supabase, contract.id);
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

  if (
    isDocuSignEnvelopeFullySigned(envelopeStatus, signers, {
      exhibitorCompleteIsFull: Boolean(event && usesSingleSignerEnvelope(event)),
    })
  ) {
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
      // If apply already wrote signed/executed, do not clobber into error — cron will retry release.
      const { data: afterFail } = await supabase
        .from('contracts')
        .select('status')
        .eq('id', contract.id)
        .maybeSingle();
      const st = (afterFail as { status?: string } | null)?.status;
      if (st === 'signed' || st === 'executed') {
        return {
          ok: true,
          changed: true,
          fromStatus: contract.status,
          toStatus: st,
          message: `Synced to ${st} (post-sign side effect failed: ${msg.slice(0, 200)})`,
        };
      }
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
