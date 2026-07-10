import { formatStatus } from '@/lib/status-display';
import { formatCurrency } from '@/lib/utils';
import { workspaceLabelForProduct } from '@/lib/product-email';
import { productKeyFromEvent } from '@/lib/product-portal';
import type { AuditLogEntry } from '@/types/db';

export type AuditDisplay = {
  title: string;
  detail?: string;
  /** Shown when entry is synthesized from contract timestamps (no audit row). */
  synthetic?: boolean;
};

function money(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? formatCurrency(n) : '$0.00';
}

export function describeAuditEntry(entry: AuditLogEntry): AuditDisplay {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const synthetic = Boolean(meta.synthetic);

  switch (entry.action) {
    case 'created':
      return { title: 'Contract created', synthetic };
    case 'contract_created': {
      const rep = String(meta.rep_name ?? meta.sales_rep_name ?? '');
      const creatorName = meta.created_by_name ? String(meta.created_by_name) : '';
      if (meta.on_behalf_of && creatorName && rep) {
        return {
          title: `Contract created by ${creatorName} on behalf of ${rep}`,
          synthetic,
        };
      }
      const ob = meta.on_behalf_of ? ' (on behalf of sales rep)' : '';
      return {
        title: `Contract created${ob}`,
        detail: rep ? `Sales rep: ${rep}` : undefined,
        synthetic,
      };
    }
    case 'status_changed': {
      const fromLabel = entry.from_status ? formatStatus(entry.from_status) : 'Unknown';
      const toLabel = entry.to_status ? formatStatus(entry.to_status) : 'Unknown';
      return { title: `Status → ${toLabel}`, detail: `Previously ${fromLabel}`, synthetic };
    }
    case 'contract_viewed': {
      const productKey = meta.product_key ? productKeyFromEvent({ product_key: String(meta.product_key) }) : null;
      const portalLabel = productKey ? workspaceLabelForProduct(productKey) : null;
      return {
        title: portalLabel ? `Contract viewed in ${portalLabel}` : 'Contract viewed',
        detail: meta.view ? String(meta.view) : undefined,
        synthetic,
      };
    }
    case 'pdf_generated':
      return { title: 'Draft PDF generated', synthetic };
    case 'events_submitted':
      return { title: 'Submitted for events team review', synthetic };
    case 'events_approved': {
      const approver = meta.approver ? String(meta.approver) : '';
      const reason = meta.reason ? String(meta.reason) : '';
      return {
        title: approver ? `Events approval granted by ${approver}` : 'Events approval granted',
        detail: reason || undefined,
        synthetic,
      };
    }
    case 'events_sent_back': {
      const sender = meta.sender ? String(meta.sender) : '';
      const reason = meta.reason ? String(meta.reason) : '';
      return {
        title: sender ? `Sent back for changes by ${sender}` : 'Sent back for changes',
        detail: reason || undefined,
        synthetic,
      };
    }
    case 'events_approval_reset': {
      const oldApprover = meta.old_approver ? String(meta.old_approver) : '';
      const reason = meta.reason ? String(meta.reason) : '';
      return {
        title: oldApprover
          ? `Events approval cleared after PDF regeneration (was ${oldApprover})`
          : 'Events approval cleared after PDF regeneration',
        detail: reason || undefined,
        synthetic,
      };
    }
    case 'discount_approved': {
      const approver = meta.approver_email ? String(meta.approver_email) : 'admin';
      const reason = meta.reason ? String(meta.reason) : '';
      return {
        title: `Discounted rate approved by ${approver}`,
        detail: reason || undefined,
        synthetic,
      };
    }
    case 'discount_approval_reset':
      return {
        title: `Discount approval reset — booth rate ${money(meta.old_rate)} → ${money(meta.new_rate)}`,
        synthetic,
      };
    case 'pdf_sent':
    case 'docusign_sent':
      return {
        title: 'Sent via DocuSign',
        detail: meta.exhibitor_signer
          ? `Exhibitor signer: ${String(meta.exhibitor_signer)}`
          : meta.envelope_id
            ? `Envelope ${String(meta.envelope_id)}`
            : undefined,
        synthetic,
      };
    case 'pdf_send_failed':
      return {
        title: 'DocuSign send failed',
        detail: meta.error ? String(meta.error) : undefined,
        synthetic,
      };
    case 'exhibitor_signed':
      return {
        title: 'Exhibitor signed (awaiting Shanken countersignature)',
        detail: meta.source === 'manual_sync' ? 'Recorded via Sync from DocuSign' : undefined,
        synthetic,
      };
    case 'countersigner_signed': {
      const name = meta.countersigner_name ? String(meta.countersigner_name) : '';
      const email = meta.countersigner_email ? String(meta.countersigner_email) : '';
      return {
        title: name ? `Countersigned by ${name}` : 'Countersigned by Shanken signatory',
        detail: email || undefined,
        synthetic,
      };
    }
    case 'docusign_completed':
      return {
        title: 'Fully signed — countersignature complete',
        detail: meta.signed_pdf_url ? 'Signed PDF stored' : undefined,
        synthetic,
      };
    case 'docusign_synced':
      return {
        title: 'Synced from DocuSign',
        detail: meta.message ? String(meta.message) : undefined,
        synthetic,
      };
    case 'docusign_send_reminder':
      return { title: 'DocuSign signing reminder sent', synthetic };
    case 'personal_nudge_sent':
      return {
        title: 'Personal signing reminder sent',
        detail: meta.signer_email ? String(meta.signer_email) : undefined,
        synthetic,
      };
    case 'docusign_resend_notification':
      return { title: 'DocuSign notification resent', synthetic };
    case 'docusign_resent_with_changes':
      return { title: 'DocuSign envelope voided and resent with changes', synthetic };
    case 'contract_recalled_to_draft':
    case 'docusign_recalled':
      return { title: 'Recalled from DocuSign — returned to draft for editing', synthetic };
    case 'released_to_accounting':
    case 'auto_released_to_accounting':
      return { title: 'Released to accounting (executed)', synthetic };
    case 'executed':
      return { title: 'Released to accounting', synthetic };
    case 'contract_imported':
      return {
        title: 'Legacy signed contract imported',
        detail: meta.originally_signed_at ? `Originally signed ${String(meta.originally_signed_at)}` : undefined,
        synthetic,
      };
    case 'contract_voided':
      return {
        title: 'Contract voided',
        detail: meta.reason ? String(meta.reason) : undefined,
        synthetic,
      };
    case 'cancelled':
      return {
        title: 'Contract cancelled',
        detail: meta.reason ? String(meta.reason) : undefined,
        synthetic,
      };
    case 'error_reset_to_draft':
      return { title: 'Error cleared — contract reset to draft', synthetic };
    case 'signer_contact_updated':
      return { title: 'Exhibitor signer contact updated', synthetic };
    case 'invoice_marked_sent':
      return { title: 'Invoice marked sent (accounting)', synthetic };
    case 'invoice_marked_paid':
      return { title: 'Payment marked received (accounting)', synthetic };
    case 'impersonation_started':
      return {
        title: 'Admin started viewing as another user',
        detail: entry.impersonation_target_email ?? undefined,
        synthetic,
      };
    case 'impersonation_ended':
      return { title: 'Admin ended impersonation session', synthetic };
    case 'voided_contract_reopened_for_edit':
      return { title: 'Voided contract reopened for editing', synthetic };
    default:
      return {
        title: entry.action.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        synthetic,
      };
  }
}

/** Short phrase for dashboard recent-activity feed. */
export function describeAuditActionShort(action: string): string {
  switch (action) {
    case 'contract_created':
      return 'created';
    case 'contract_viewed':
      return 'viewed';
    case 'events_submitted':
      return 'submitted for events review';
    case 'events_approved':
      return 'approved for sending';
    case 'pdf_sent':
    case 'docusign_sent':
      return 'sent via DocuSign';
    case 'exhibitor_signed':
      return 'exhibitor signed';
    case 'countersigner_signed':
      return 'countersigned';
    case 'docusign_completed':
      return 'fully signed';
    case 'docusign_synced':
      return 'synced from DocuSign';
    case 'released_to_accounting':
    case 'auto_released_to_accounting':
      return 'released to accounting';
    case 'invoice_marked_sent':
      return 'marked invoice sent for';
    case 'invoice_marked_paid':
      return 'marked paid for';
    case 'contract_voided':
      return 'voided';
    case 'cancelled':
      return 'cancelled';
    case 'discount_approved':
      return 'approved a discount on';
    default:
      return action.replaceAll('_', ' ');
  }
}

export function auditDotClass(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('void') || a.includes('cancel') || a.includes('error') || a.includes('failed')) {
    return 'border-danger-base bg-danger-bg text-danger-base';
  }
  if (a.includes('exhibitor_signed')) {
    return 'border-orange-600/40 bg-orange-50 text-orange-900';
  }
  if (a.includes('countersigner') || a.includes('docusign_completed') || a.includes('fully signed')) {
    return 'border-green-700/35 bg-green-50 text-green-900';
  }
  if (a.includes('released') || a.includes('executed') || a.includes('paid')) {
    return 'border-whisky-700/50 bg-whisky-100 text-whisky-900';
  }
  if (a.includes('invoice')) {
    return 'border-teal-700/35 bg-teal-50 text-teal-900';
  }
  if (a.includes('pdf_sent') || (a.includes('docusign') && a.includes('sent'))) {
    return 'border-violet-600/35 bg-violet-100 text-violet-900';
  }
  if (a.includes('events_approved') || a.includes('discount_approved')) {
    return 'border-blue-600/35 bg-blue-50 text-blue-900';
  }
  if (a.includes('events') || a.includes('submitted') || a.includes('review')) {
    return 'border-yellow-600/40 bg-yellow-50 text-yellow-900';
  }
  if (a.includes('viewed')) {
    return 'border-slate-400/50 bg-slate-100 text-slate-800';
  }
  if (a.includes('imported')) {
    return 'border-teal-700/35 bg-teal-50 text-teal-900';
  }
  return 'border-parchment-300 bg-parchment-50 text-ink-500';
}
