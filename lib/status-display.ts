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
      return 'border border-gray-300 bg-gray-100 text-gray-800';
    case 'pending_events_review':
      return 'border border-amber-300 bg-amber-100 text-amber-900';
    case 'approved':
      return 'border border-blue-300 bg-blue-100 text-blue-900';
    case 'sent':
      return 'border border-indigo-300 bg-indigo-100 text-indigo-900';
    case 'partially_signed':
      return 'border border-purple-300 bg-purple-100 text-purple-900';
    case 'fully_signed':
    case 'signed':
      return 'border border-teal-300 bg-teal-100 text-teal-900';
    case 'executed':
      return 'border border-emerald-300 bg-emerald-100 text-emerald-900';
    case 'cancelled':
      return 'border border-gray-300 bg-gray-200 text-gray-800';
    case 'declined':
    case 'voided':
      return 'border border-red-300 bg-red-100 text-red-900';
    case 'error':
      return 'border border-red-300 bg-red-100 text-red-950';
    default:
      return 'border border-gray-300 bg-gray-100 text-gray-800';
  }
}
