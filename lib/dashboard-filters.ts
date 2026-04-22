import { requiresDiscountApproval } from '@/lib/contracts';
import type { ContractWithTotals } from '@/types/db';

export type DashboardFilterKey =
  | 'all'
  | 'draft'
  | 'events_review'
  | 'approved'
  | 'sent'
  | 'exhibitor_signed'
  | 'fully_signed'
  | 'executed'
  | 'cancelled'
  | 'staff_needs_approval'
  | 'staff_countersign'
  | 'staff_ready_release'
  | 'rep_attention'
  | 'rep_events'
  | 'rep_ready_send';

export function parseDashboardFilter(raw: string | undefined): DashboardFilterKey {
  const allowed = new Set<string>([
    'all',
    'draft',
    'events_review',
    'approved',
    'sent',
    'exhibitor_signed',
    'fully_signed',
    'executed',
    'cancelled',
    'staff_needs_approval',
    'staff_countersign',
    'staff_ready_release',
    'rep_attention',
    'rep_events',
    'rep_ready_send',
  ]);
  if (raw && allowed.has(raw)) return raw as DashboardFilterKey;
  return 'all';
}

export function isStaffDashboardPersona(isAdmin: boolean, isEventsTeam: boolean): boolean {
  return isAdmin || isEventsTeam;
}

export function contractMatchesDashboardFilter(
  c: ContractWithTotals,
  filter: DashboardFilterKey,
  accessibleSalesRepIds: string[],
): boolean {
  const repOwns =
    c.sales_rep_id != null && accessibleSalesRepIds.includes(c.sales_rep_id);

  switch (filter) {
    case 'all':
      return true;
    case 'draft':
      return c.status === 'draft' || c.status === 'ready_for_review';
    case 'events_review':
      return c.status === 'pending_events_review';
    case 'approved':
      return c.status === 'approved';
    case 'sent':
      return c.status === 'sent';
    case 'exhibitor_signed':
      return c.status === 'partially_signed';
    case 'fully_signed':
      return c.status === 'signed';
    case 'executed':
      return c.status === 'executed';
    case 'cancelled':
      return c.status === 'cancelled';
    case 'staff_needs_approval':
      return requiresDiscountApproval(c) || c.status === 'pending_events_review';
    case 'staff_countersign':
      return c.status === 'partially_signed';
    case 'staff_ready_release':
      return c.status === 'signed';
    case 'rep_attention':
      return repOwns && (c.status === 'error' || (c.status === 'draft' && Boolean(c.events_sent_back_at)));
    case 'rep_events':
      return repOwns && c.status === 'pending_events_review';
    case 'rep_ready_send':
      return repOwns && c.status === 'approved';
    default:
      return true;
  }
}
