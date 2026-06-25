import { formatCalendarDateOnly } from '@/lib/datetime';
import type { PipelineRow } from '@/lib/event-metrics';
import { PIPELINE_BAR_COLORS, type PipelineStageKey } from '@/lib/status-display';
import type { ContractWithTotals, Event } from '@/types/db';

const NYWE_PIPELINE: { key: PipelineStageKey; label: string; statuses: string[] }[] = [
  { key: 'draft', label: 'Draft', statuses: ['draft', 'ready_for_review'] },
  { key: 'pending_events_review', label: 'In review', statuses: ['pending_events_review', 'imported'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'sent', label: 'With winery', statuses: ['sent'] },
  { key: 'partially_signed', label: 'Winery signed', statuses: ['partially_signed'] },
  { key: 'signed', label: 'Countersigned', statuses: ['signed'] },
  { key: 'executed', label: 'Executed', statuses: ['executed'] },
];

export type NyweDashboardMetrics = {
  totalLicenses: number;
  rosterWineries: number;
  bookedRevenueCents: number;
  executedRevenueCents: number;
  inFlightRevenueCents: number;
  pipelineRevenueCents: number;
  executedCount: number;
  waitingOnWineryCount: number;
  readyToCountersignCount: number;
  completionPct: number;
  daysToEvent: number;
  eventDateLabel: string;
};

function countStatuses(contracts: ContractWithTotals[], statuses: string[]): number {
  return contracts.filter((c) => statuses.includes(c.status)).length;
}

export function buildNyweDashboardMetrics(
  contracts: ContractWithTotals[],
  event: Event | null,
  options?: { rosterWineryCount?: number },
): NyweDashboardMetrics {
  const active = contracts.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');
  const executed = active.filter((c) => c.status === 'executed');
  const booked = active.filter((c) => c.status === 'signed' || c.status === 'executed');
  const inFlight = active.filter((c) => ['sent', 'partially_signed', 'signed'].includes(c.status));

  const eventDate = event?.event_date ? new Date(event.event_date) : null;
  const daysToEvent =
    eventDate && Number.isFinite(eventDate.getTime())
      ? Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / 86400000))
      : 0;

  const rosterWineries = options?.rosterWineryCount ?? active.length;
  const completionPct =
    rosterWineries > 0 ? Math.round((executed.length / rosterWineries) * 100) : 0;

  return {
    totalLicenses: active.length,
    rosterWineries,
    bookedRevenueCents: booked.reduce((s, c) => s + c.grand_total_cents, 0),
    executedRevenueCents: executed.reduce((s, c) => s + c.grand_total_cents, 0),
    inFlightRevenueCents: inFlight.reduce((s, c) => s + c.grand_total_cents, 0),
    pipelineRevenueCents: active.reduce((s, c) => s + c.grand_total_cents, 0),
    executedCount: executed.length,
    waitingOnWineryCount: countStatuses(active, ['sent']),
    readyToCountersignCount: countStatuses(active, ['partially_signed']),
    completionPct,
    daysToEvent,
    eventDateLabel: event?.event_date ? formatCalendarDateOnly(event.event_date) : '—',
  };
}

export function getNywePipelineData(contracts: ContractWithTotals[]): PipelineRow[] {
  const active = contracts.filter((c) => c.status !== 'cancelled' && c.status !== 'voided');

  return NYWE_PIPELINE.map(({ key, label, statuses }) => {
    const matching = active.filter((c) => statuses.includes(c.status));
    return {
      key,
      label,
      count: matching.length,
      totalCents: matching.reduce((sum, c) => sum + c.grand_total_cents, 0),
      href: `/wine-spectator/contracts?status=${key === 'draft' ? 'draft' : key}`,
    };
  });
}

export function nywePipelineLegend(): { key: PipelineStageKey; label: string; color: string }[] {
  return NYWE_PIPELINE.map(({ key, label }) => ({
    key,
    label,
    color: PIPELINE_BAR_COLORS[key],
  }));
}
