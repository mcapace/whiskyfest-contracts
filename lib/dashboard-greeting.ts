import type { ContractWithTotals } from '@/types/db';

export type SmartGreetingMetrics = {
  pendingReview: number;
  discountPending: number;
  stuckContracts: number;
  myUnsignedSent: number;
  myDrafts: number;
};

const STUCK_STATUSES = new Set(['sent', 'pending_events_review', 'draft', 'ready_for_review', 'approved']);

function daysSince(iso: string | null | undefined, from = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((from - t) / 86400000);
}

export function buildSmartMetrics(
  contracts: ContractWithTotals[],
  salesRepId: string | null,
  discountPendingFn: (c: ContractWithTotals) => boolean,
): SmartGreetingMetrics {
  const pendingReview = contracts.filter((c) => c.status === 'pending_events_review').length;
  const discountPending = contracts.filter(discountPendingFn).length;
  const stuckContracts = contracts.filter((c) => {
    if (!STUCK_STATUSES.has(c.status)) return false;
    return daysSince(c.updated_at) > 7;
  }).length;

  const myUnsignedSent =
    salesRepId == null
      ? 0
      : contracts.filter((c) => c.status === 'sent' && c.sales_rep_id === salesRepId && Boolean(c.sent_at)).length;

  const myDrafts =
    salesRepId == null
      ? 0
      : contracts.filter(
          (c) =>
            c.sales_rep_id === salesRepId && (c.status === 'draft' || c.status === 'ready_for_review'),
        ).length;

  return { pendingReview, discountPending, stuckContracts, myUnsignedSent, myDrafts };
}

export function greetingHour(timeZone: string): number {
  const s = new Date().toLocaleString('en-US', { timeZone, hour: 'numeric', hour12: false });
  const h = parseInt(s, 10);
  return Number.isFinite(h) ? h : new Date().getHours();
}

export function greetingWord(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function buildGreetingSubtitle(
  role: string,
  isEventsTeam: boolean,
  isAdmin: boolean,
  metrics: SmartGreetingMetrics,
  daysToEvent: number,
): string {
  const messages: string[] = [];
  const staff = isAdmin || isEventsTeam;

  if (staff) {
    if (metrics.pendingReview > 0) {
      messages.push(
        `${metrics.pendingReview} contract${metrics.pendingReview > 1 ? 's' : ''} awaiting events review`,
      );
    }
    if (metrics.discountPending > 0) {
      messages.push(
        `${metrics.discountPending} discount approval${metrics.discountPending > 1 ? 's' : ''} pending`,
      );
    }
    if (metrics.stuckContracts > 0) {
      messages.push(`${metrics.stuckContracts} contract${metrics.stuckContracts > 1 ? 's' : ''} quiet for 7+ days`);
    }
  }

  if (role === 'sales_rep' || role === 'sales') {
    if (metrics.myUnsignedSent > 0) {
      messages.push(`${metrics.myUnsignedSent} of your contracts out for signature`);
    }
    if (metrics.myDrafts > 0) {
      messages.push(`${metrics.myDrafts} draft${metrics.myDrafts > 1 ? 's' : ''} to finish`);
    }
  }

  if (messages.length > 0) return messages.join(' · ');
  return `Everything looks on track · WhiskyFest in ${daysToEvent} day${daysToEvent === 1 ? '' : 's'}`;
}
