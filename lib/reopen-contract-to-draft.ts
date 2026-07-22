import { voidEnvelope } from '@/lib/docusign';
import type { ContractStatus } from '@/types/db';

/** Best-effort void so a replacement envelope can be sent. */
export async function voidContractEnvelopeIfPresent(
  envelopeId: string | null | undefined,
  reason: string,
): Promise<void> {
  const id = envelopeId?.trim();
  if (!id) return;
  try {
    await voidEnvelope(id, reason.slice(0, 900));
  } catch (err) {
    console.error('[reopen-contract-to-draft] DocuSign void failed, continuing', err);
  }
}

/** Clears DocuSign + execution + AR handoff so a corrected deal can be re-sent cleanly. */
export function contractReopenToDraftPatch(from: 'voided' | 'cancelled') {
  const base = {
    status: 'draft' as const,
    docusign_envelope_id: null,
    sent_at: null,
    signed_at: null,
    countersigned_at: null,
    countersigned_by_email: null,
    countersigned_by_name: null,
    executed_at: null,
    events_approved_at: null,
    events_approved_by: null,
    events_approval_reason: null,
    accounting_notified_at: null,
    invoice_status: 'pending' as const,
    invoice_sent_at: null,
    invoice_sent_by: null,
    paid_at: null,
  };
  if (from === 'voided') {
    return {
      ...base,
      voided_at: null,
      voided_by: null,
      voided_reason: null,
    };
  }
  return {
    ...base,
    cancelled_reason: null,
    cancelled_at: null,
    cancelled_by: null,
  };
}

export function contractCanReopenToDraft(status: ContractStatus): boolean {
  return status === 'voided' || status === 'cancelled';
}
