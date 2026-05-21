import type { ContractStatus } from '@/types/db';

/** Pipeline / chart keys (includes draft bucket for ready_for_review). */
export type PipelineStageKey =
  | 'draft'
  | 'pending_events_review'
  | 'approved'
  | 'sent'
  | 'partially_signed'
  | 'signed'
  | 'executed';

/**
 * Bar fill colors for the dashboard pipeline chart — each stage uses a distinct hue.
 * Keep in sync with statusBadgeClassName semantics below.
 */
export const PIPELINE_BAR_COLORS: Record<PipelineStageKey, string> = {
  draft: '#94A3B8', // slate — not yet in workflow
  pending_events_review: '#CA8A04', // gold — awaiting events
  approved: '#2563EB', // blue — cleared to send
  sent: '#7C3AED', // violet — with exhibitor in DocuSign
  partially_signed: '#EA580C', // orange — exhibitor signed
  signed: '#16A34A', // green — fully signed
  executed: '#663033', // whisky burgundy — released / executed
};

export function pipelineBarColor(key: string): string {
  return PIPELINE_BAR_COLORS[key as PipelineStageKey] ?? '#94A3B8';
}

/** Hex color for contract progression timeline nodes (matches pipeline semantics). */
export function progressionStageColor(stage: string): string {
  switch (stage) {
    case 'ready_for_review':
      return PIPELINE_BAR_COLORS.draft;
    case 'pending_events_review':
      return PIPELINE_BAR_COLORS.pending_events_review;
    case 'approved':
      return PIPELINE_BAR_COLORS.approved;
    case 'sent':
      return PIPELINE_BAR_COLORS.sent;
    case 'partially_signed':
      return PIPELINE_BAR_COLORS.partially_signed;
    case 'signed':
      return PIPELINE_BAR_COLORS.signed;
    case 'executed':
      return PIPELINE_BAR_COLORS.executed;
    case 'draft':
    default:
      return PIPELINE_BAR_COLORS.draft;
  }
}

/** Tailwind classes for status badges (single source for labels + colors). */
export function formatStatus(status: ContractStatus | string): string {
  switch (status as string) {
    case 'draft':
      return 'Draft';
    case 'ready_for_review':
      return 'In Review';
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
    case 'imported':
      return 'Imported';
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
 * Stages use clearly separated hues (gray → gold → blue → violet → orange → green → burgundy).
 */
export function statusBadgeClassName(status: ContractStatus | string): string {
  switch (status as string) {
    case 'draft':
    case 'ready_for_review':
      return 'border border-slate-400/50 bg-slate-100 text-slate-800';
    case 'pending_events_review':
      return 'border border-yellow-600/40 bg-yellow-50 text-yellow-900';
    case 'approved':
      return 'border border-blue-600/35 bg-blue-50 text-blue-900';
    case 'sent':
      return 'border border-violet-600/35 bg-violet-100 text-violet-900';
    case 'partially_signed':
      return 'border border-orange-600/40 bg-orange-50 text-orange-900';
    case 'fully_signed':
    case 'signed':
      return 'border border-green-700/35 bg-green-50 text-green-900';
    case 'imported':
      return 'border border-teal-700/35 bg-teal-50 text-teal-900';
    case 'executed':
      return 'border border-whisky-700/50 bg-whisky-100 text-whisky-900';
    case 'cancelled':
      return 'border border-slate-500/40 bg-slate-200 text-slate-800';
    case 'declined':
    case 'voided':
      return 'border border-danger-base/30 bg-danger-bg text-danger-base';
    case 'error':
      return 'border border-danger-base/30 bg-danger-bg text-danger-base';
    default:
      return 'border border-ink-300 bg-parchment-100 text-ink-700';
  }
}
