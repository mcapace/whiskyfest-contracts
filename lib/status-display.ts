import type { ContractStatus } from '@/types/db';

/** Tailwind classes for status badges (single source for labels + colors). */
export function formatStatus(status: ContractStatus | string): string {
  switch (status as string) {
    case 'draft':
      return 'Draft';
    case 'ready_for_review':
      return 'Draft';
    case 'pending_events_review':
      return 'Events Review';
    case 'approved':
      return 'Approved';
    case 'sent':
      return 'Sent';
    case 'partially_signed':
      return 'Exhibitor Signed';
    case 'fully_signed':
      return 'Fully Signed';
    case 'signed':
      return 'Fully Signed';
    case 'executed':
      return 'Executed';
    case 'cancelled':
      return 'Cancelled';
    case 'declined':
      return 'Declined';
    case 'voided':
      return 'Voided';
    case 'error':
      return 'Error';
    default:
      return String(status);
  }
}

/**
 * Badge styles: always dark text on light tint (WCAG-friendly).
 * Avoid white text on pale backgrounds (e.g. executed was unreadable).
 */
export function statusBadgeClassName(status: ContractStatus | string): string {
  switch (status as string) {
    case 'draft':
    case 'ready_for_review':
      return 'border border-ink-500 bg-ink-500 text-parchment-50';
    case 'pending_events_review':
      return 'border border-warning-base/30 bg-warning-bg text-warning-base';
    case 'approved':
      return 'border border-info-base/30 bg-info-bg text-info-base';
    case 'sent':
      return 'border border-amber-600/30 bg-amber-100 text-amber-700';
    case 'partially_signed':
      return 'border border-amber-600/30 bg-amber-100 text-amber-700';
    case 'fully_signed':
    case 'signed':
      return 'border border-success-base/30 bg-success-bg text-success-base';
    case 'executed':
      return 'border border-oak-800 bg-oak-800 text-parchment-50';
    case 'cancelled':
      return 'border border-ink-300 bg-ink-300 text-oak-800';
    case 'declined':
    case 'voided':
      return 'border border-danger-base/30 bg-danger-bg text-danger-base';
    case 'error':
      return 'border border-danger-base/30 bg-danger-bg text-danger-base';
    default:
      return 'border border-ink-300 bg-parchment-100 text-ink-700';
  }
}
