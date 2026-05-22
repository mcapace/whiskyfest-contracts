import {
  BRAND_CATEGORIES,
  categorizeBrandFromName,
  parseBrandNamesFromBrandsPoured,
  type BrandCategory,
} from '@/lib/brand-category';
import { requiresDiscountApproval } from '@/lib/contracts';
import type { AuditLogEntry, ContractWithTotals, Event } from '@/types/db';

const EVENT_DATE_FALLBACK = '2026-11-20T18:30:00-05:00';

const PIPELINE_ORDER = [
  'draft',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'signed',
  'executed',
] as const;

const PIPELINE_LABELS: Record<(typeof PIPELINE_ORDER)[number], string> = {
  draft: 'Draft',
  pending_events_review: 'Pending Review',
  approved: 'Approved',
  sent: 'Sent',
  partially_signed: 'Partially Signed',
  signed: 'Signed',
  executed: 'Executed',
};

const PIPELINE_FILTERS: Record<(typeof PIPELINE_ORDER)[number], string> = {
  draft: 'draft',
  pending_events_review: 'pending_events_review',
  approved: 'approved',
  sent: 'sent',
  partially_signed: 'partially_signed',
  signed: 'signed',
  executed: 'executed',
};

type PipelineKey = (typeof PIPELINE_ORDER)[number];

export interface EventVitalSigns {
  contractedRevenueCents: number;
  signedContracts: number;
  signedBooths: number;
  daysToEvent: number;
  eventDateLabel: string;
}

export interface PipelineRow {
  key: PipelineKey;
  label: string;
  count: number;
  totalCents: number;
  href: string;
}

export interface LeaderboardRow {
  email: string;
  name: string;
  contractsSigned: number;
  totalValueCents: number;
}

export interface ActivityRow {
  id: string;
  contractId: string | null;
  contractName: string | null;
  actor: string;
  action: string;
  occurredAt: string;
}

export type DeadlineSeverity = 'high' | 'medium';
export interface DeadlineRow {
  id: string;
  label: string;
  detail: string;
  link: string;
  severity: DeadlineSeverity;
  days: number;
}

export interface BrandMixRow {
  name: string;
  count: number;
  percentage: number;
}

function getNextEventDate(events: Event[]): Date {
  const now = Date.now();
  const upcoming = events
    .map((e) => new Date(e.event_date))
    .filter((d) => Number.isFinite(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
    .find((d) => d.getTime() >= now);
  return upcoming ?? new Date(EVENT_DATE_FALLBACK);
}

function daysSince(input: string | null | undefined, nowMs: number): number {
  if (!input) return 0;
  const ms = new Date(input).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.floor((nowMs - ms) / 86400000);
}

export function getEventVitalSigns(contracts: ContractWithTotals[], events: Event[]): EventVitalSigns {
  const signedRows = contracts.filter((c) => c.status === 'signed' || c.status === 'executed');
  const contractedRevenueCents = signedRows.reduce((sum, c) => sum + c.grand_total_cents, 0);
  const signedContracts = signedRows.length;
  const signedBooths = signedRows.reduce((sum, c) => sum + (c.booth_count ?? 0), 0);
  const nextEvent = getNextEventDate(events);
  const daysToEvent = Math.max(0, Math.ceil((nextEvent.getTime() - Date.now()) / 86400000));

  return {
    contractedRevenueCents,
    signedContracts,
    signedBooths,
    daysToEvent,
    eventDateLabel: 'November 20, 2026',
  };
}

export function getPipelineData(contracts: ContractWithTotals[]): PipelineRow[] {
  return PIPELINE_ORDER.map((key) => {
    const matching = contracts.filter((c) => {
      if (key === 'draft') return c.status === 'draft' || c.status === 'ready_for_review';
      return c.status === key;
    });
    return {
      key,
      label: PIPELINE_LABELS[key],
      count: matching.length,
      totalCents: matching.reduce((sum, c) => sum + c.grand_total_cents, 0),
      href: `/contracts?status=${PIPELINE_FILTERS[key]}`,
    };
  });
}

export function getSalesLeaderboard(contracts: ContractWithTotals[]): LeaderboardRow[] {
  const byRep = new Map<string, LeaderboardRow>();

  for (const c of contracts) {
    if (c.status !== 'signed' && c.status !== 'executed') continue;
    if (!c.sales_rep_email) continue;
    const key = c.sales_rep_email.trim().toLowerCase();
    if (!byRep.has(key)) {
      byRep.set(key, {
        email: key,
        name: c.sales_rep_name?.trim() || c.sales_rep_email,
        contractsSigned: 0,
        totalValueCents: 0,
      });
    }
    const rep = byRep.get(key)!;
    rep.contractsSigned += 1;
    rep.totalValueCents += c.grand_total_cents;
  }

  return [...byRep.values()].sort((a, b) => b.totalValueCents - a.totalValueCents);
}

export { describeAuditActionShort as describeAuditAction } from '@/lib/audit-log-display';

export function getRecentActivity(audit: AuditLogEntry[], contracts: ContractWithTotals[]): ActivityRow[] {
  const contractNameById = new Map(contracts.map((c) => [c.id, c.exhibitor_company_name]));
  return audit.slice(0, 15).map((a) => ({
    id: String(a.id),
    contractId: a.contract_id,
    contractName: a.contract_id ? contractNameById.get(a.contract_id) ?? null : null,
    actor: a.actor_email ?? 'System',
    action: a.action,
    occurredAt: a.occurred_at,
  }));
}

export function getDeadlines(contracts: ContractWithTotals[]): DeadlineRow[] {
  const nowMs = Date.now();
  const items: DeadlineRow[] = [];

  for (const c of contracts) {
    const company = c.exhibitor_company_name;
    const link = `/contracts/${c.id}`;

    if (c.status === 'pending_events_review') {
      const days = daysSince(c.events_submitted_at ?? c.created_at, nowMs);
      if (days > 3) {
        items.push({
          id: `${c.id}-review`,
          label: company,
          detail: `Awaiting events review for ${days} day${days === 1 ? '' : 's'}`,
          link,
          severity: days > 7 ? 'high' : 'medium',
          days,
        });
      }
    }

    if (c.status === 'sent' && c.sent_at) {
      const days = daysSince(c.sent_at, nowMs);
      if (days > 7) {
        items.push({
          id: `${c.id}-unsigned`,
          label: company,
          detail: `Sent ${days} day${days === 1 ? '' : 's'} ago, awaiting signature`,
          link,
          severity: days > 14 ? 'high' : 'medium',
          days,
        });
      }
    }

    if (c.status === 'signed' && c.signed_at) {
      const days = daysSince(c.signed_at, nowMs);
      if (days > 5) {
        items.push({
          id: `${c.id}-release`,
          label: company,
          detail: `Awaiting accounting handoff for ${days} day${days === 1 ? '' : 's'}`,
          link,
          severity: days > 10 ? 'high' : 'medium',
          days,
        });
      }
    }

    if (c.status === 'executed' && c.executed_at && c.invoice_status === 'pending') {
      const days = daysSince(c.executed_at, nowMs);
      if (days > 14) {
        items.push({
          id: `${c.id}-invoice`,
          label: company,
          detail: `Invoice overdue by ${days} day${days === 1 ? '' : 's'} since execution`,
          link,
          severity: days > 21 ? 'high' : 'medium',
          days,
        });
      }
    }

    if (requiresDiscountApproval(c)) {
      const days = daysSince(c.updated_at, nowMs);
      if (days > 2) {
        items.push({
          id: `${c.id}-discount`,
          label: company,
          detail: `Awaiting discount approval for ${days} day${days === 1 ? '' : 's'}`,
          link,
          severity: days > 5 ? 'high' : 'medium',
          days,
        });
      }
    }
  }

  return items
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
      return b.days - a.days;
    })
    .slice(0, 12);
}

export type BoothBrandMixInput = { contract_id: string; brand_name: string };

export function getBrandMix(
  contracts: ContractWithTotals[],
  boothBrands: BoothBrandMixInput[] = [],
): BrandMixRow[] {
  const counts = new Map<BrandCategory, number>(BRAND_CATEGORIES.map((c) => [c, 0]));

  const boothByContract = new Map<string, string[]>();
  for (const row of boothBrands) {
    const name = row.brand_name?.trim();
    if (!name) continue;
    const list = boothByContract.get(row.contract_id) ?? [];
    list.push(name);
    boothByContract.set(row.contract_id, list);
  }

  for (const contract of contracts) {
    if (contract.status === 'cancelled' || contract.status === 'voided') continue;

    const boothNames = boothByContract.get(contract.id) ?? [];
    const brandNames =
      boothNames.length > 0 ? boothNames : parseBrandNamesFromBrandsPoured(contract.brands_poured);

    for (const brand of brandNames) {
      const category = categorizeBrandFromName(brand, contract.exhibitor_company_name);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return BRAND_CATEGORIES.map((name) => {
    const count = counts.get(name) ?? 0;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return { name, count, percentage };
  }).sort((a, b) => b.count - a.count);
}
