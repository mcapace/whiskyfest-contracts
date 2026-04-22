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
    case 'error':
      return 'Error';
    default:
      return String(status);
  }
}

export type StatusColor = 'gray' | 'amber' | 'blue' | 'purple' | 'emerald' | 'green' | 'red';

export function statusColor(status: ContractStatus | string): StatusColor {
  switch (status as string) {
    case 'draft':
    case 'ready_for_review':
      return 'gray';
    case 'pending_events_review':
      return 'amber';
    case 'approved':
      return 'blue';
    case 'sent':
    case 'partially_signed':
      return 'purple';
    case 'fully_signed':
    case 'signed':
      return 'emerald';
    case 'executed':
      return 'green';
    case 'cancelled':
      return 'red';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

const COLOR_BADGE: Record<StatusColor, string> = {
  gray: 'border bg-whisky-100 text-whisky-900 border-whisky-300',
  amber: 'border bg-amber-100 text-amber-900 border-amber-300',
  blue: 'border bg-blue-100 text-blue-900 border-blue-300',
  purple: 'border bg-violet-100 text-violet-900 border-violet-300',
  emerald: 'border bg-emerald-50 text-emerald-800 border-emerald-300',
  green: 'border bg-emerald-600 text-white border-emerald-700',
  red: 'border bg-red-100 text-red-900 border-red-300',
};

export function statusBadgeClassName(status: ContractStatus | string): string {
  return COLOR_BADGE[statusColor(status)];
}
