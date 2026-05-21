import type { AuditLogEntry, ContractWithTotals } from '@/types/db';

let syntheticId = -1;

function nextSyntheticId(): number {
  syntheticId -= 1;
  return syntheticId;
}

function hasAction(audit: AuditLogEntry[], names: string[]): boolean {
  const set = new Set(names);
  return audit.some((e) => set.has(e.action));
}

function syntheticEntry(
  contractId: string,
  occurredAt: string,
  action: string,
  opts?: {
    from_status?: AuditLogEntry['from_status'];
    to_status?: AuditLogEntry['to_status'];
    metadata?: Record<string, unknown>;
  },
): AuditLogEntry {
  return {
    id: nextSyntheticId(),
    contract_id: contractId,
    actor_email: null,
    action,
    from_status: opts?.from_status ?? null,
    to_status: opts?.to_status ?? null,
    metadata: { synthetic: true, ...opts?.metadata },
    occurred_at: occurredAt,
  };
}

/**
 * Merge audit_log rows with milestone entries inferred from contract timestamps
 * when older contracts predate audit coverage (e.g. missed webhooks).
 */
export function buildContractActivityTimeline(
  audit: AuditLogEntry[],
  contract: ContractWithTotals,
): AuditLogEntry[] {
  const rows = [...audit];
  const cid = contract.id;

  if (contract.drafted_at && !hasAction(rows, ['pdf_generated'])) {
    rows.push(
      syntheticEntry(cid, contract.drafted_at, 'pdf_generated', {
        metadata: { note: 'Inferred from drafted_at' },
      }),
    );
  }

  if (contract.events_submitted_at && !hasAction(rows, ['events_submitted'])) {
    rows.push(
      syntheticEntry(cid, contract.events_submitted_at, 'events_submitted', {
        to_status: 'pending_events_review',
      }),
    );
  }

  if (contract.events_approved_at && !hasAction(rows, ['events_approved'])) {
    rows.push(
      syntheticEntry(cid, contract.events_approved_at, 'events_approved', {
        metadata: {
          approver: contract.events_approved_by ?? undefined,
          reason: contract.events_approval_reason ?? undefined,
        },
        to_status: 'approved',
      }),
    );
  }

  if (contract.sent_at && !hasAction(rows, ['pdf_sent', 'docusign_sent'])) {
    rows.push(
      syntheticEntry(cid, contract.sent_at, 'pdf_sent', {
        metadata: { exhibitor_signer: contract.signer_1_email ?? undefined },
        to_status: 'sent',
      }),
    );
  }

  const exhibitorSignedAt =
    contract.exhibitor_fields_captured_at ??
    (['partially_signed', 'signed', 'executed'].includes(contract.status) && contract.sent_at
      ? contract.sent_at
      : null);

  if (
    exhibitorSignedAt &&
    !hasAction(rows, ['exhibitor_signed']) &&
    ['partially_signed', 'signed', 'executed'].includes(contract.status)
  ) {
    rows.push(
      syntheticEntry(cid, exhibitorSignedAt, 'exhibitor_signed', {
        to_status: 'partially_signed',
        metadata: { note: 'Inferred from signing timestamps' },
      }),
    );
  }

  if (contract.countersigned_at && !hasAction(rows, ['countersigner_signed'])) {
    rows.push(
      syntheticEntry(cid, contract.countersigned_at, 'countersigner_signed', {
        metadata: {
          countersigner_name: contract.countersigned_by_name ?? undefined,
          countersigner_email: contract.countersigned_by_email ?? undefined,
        },
      }),
    );
  }

  if (
    contract.signed_at &&
    !hasAction(rows, ['docusign_completed']) &&
    ['signed', 'executed'].includes(contract.status)
  ) {
    rows.push(
      syntheticEntry(cid, contract.signed_at, 'docusign_completed', {
        to_status: 'signed',
        metadata: { note: 'Inferred from signed_at' },
      }),
    );
  }

  if (contract.executed_at && !hasAction(rows, ['released_to_accounting', 'executed'])) {
    rows.push(
      syntheticEntry(cid, contract.executed_at, 'released_to_accounting', {
        to_status: 'executed',
      }),
    );
  }

  if (contract.invoice_sent_at && !hasAction(rows, ['invoice_marked_sent', 'invoice_sent'])) {
    rows.push(
      syntheticEntry(cid, contract.invoice_sent_at, 'invoice_marked_sent', {
        metadata: { by: contract.invoice_sent_by ?? undefined },
      }),
    );
  }

  if (contract.paid_at && !hasAction(rows, ['invoice_marked_paid', 'paid'])) {
    rows.push(
      syntheticEntry(cid, contract.paid_at, 'invoice_marked_paid', {
        metadata: { by: contract.paid_by ?? undefined },
      }),
    );
  }

  if (contract.imported_at && !hasAction(rows, ['contract_imported'])) {
    rows.push(
      syntheticEntry(cid, contract.imported_at, 'contract_imported', {
        metadata: {
          originally_signed_at: contract.originally_signed_at ?? undefined,
          by: contract.imported_by ?? undefined,
        },
        to_status: 'imported',
      }),
    );
  }

  return rows.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}
