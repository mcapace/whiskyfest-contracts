'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatStatus } from '@/lib/status-display';
import { cn, formatRelative } from '@/lib/utils';
import type { AuditLogEntry, ContractStatus } from '@/types/db';

const STAGE_ORDER: Exclude<ContractStatus, 'cancelled' | 'error'>[] = [
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'signed',
  'executed',
];

function auditForStage(stage: (typeof STAGE_ORDER)[number], auditChronological: AuditLogEntry[]): AuditLogEntry | null {
  const pick = (predicate: (e: AuditLogEntry) => boolean) => {
    const found = [...auditChronological].reverse().find(predicate);
    return found ?? null;
  };

  switch (stage) {
    case 'draft':
      return pick((e) => e.action === 'created' || e.action === 'contract_created');
    case 'ready_for_review':
      return pick((e) => e.action === 'status_changed' && e.to_status === 'ready_for_review');
    case 'pending_events_review':
      return pick(
        (e) =>
          e.action === 'events_submitted' ||
          (e.action === 'status_changed' && e.to_status === 'pending_events_review'),
      );
    case 'approved':
      return pick((e) => e.action === 'events_approved' || (e.action === 'status_changed' && e.to_status === 'approved'));
    case 'sent':
      return pick(
        (e) =>
          e.action === 'docusign_sent' ||
          e.action === 'pdf_sent' ||
          (e.action === 'status_changed' && e.to_status === 'sent'),
      );
    case 'partially_signed':
      return pick((e) => e.action === 'status_changed' && e.to_status === 'partially_signed');
    case 'signed':
      return pick((e) => e.action === 'signed' || (e.action === 'status_changed' && e.to_status === 'signed'));
    case 'executed':
      return pick(
        (e) =>
          e.action === 'executed' ||
          e.action === 'released_to_accounting' ||
          (e.action === 'status_changed' && e.to_status === 'executed'),
      );
    default:
      return null;
  }
}

function actorLabel(entry: AuditLogEntry | null, stage: (typeof STAGE_ORDER)[number]): string | null {
  if (!entry) return null;
  const meta = entry.metadata as Record<string, unknown> | null;
  if (stage === 'approved' && meta?.approver) return String(meta.approver);
  if (meta?.approver_email) return String(meta.approver_email);
  if (entry.actor_email) return entry.actor_email.split('@')[0]?.replace(/\./g, ' ') ?? entry.actor_email;
  return null;
}

function stageTooltip(stage: (typeof STAGE_ORDER)[number], entry: AuditLogEntry | null, done: boolean, current: boolean) {
  const label = formatStatus(stage);
  if (current) return `${label} — in progress`;
  if (!done) return `${label} — not started`;
  if (!entry) return `${label} — completed`;
  const who = actorLabel(entry, stage);
  const when = formatRelative(entry.occurred_at);
  if (who) return `${label} ${when} by ${who}`;
  return `${label} ${when}`;
}

export function ContractProgressionTimeline({
  status,
  audit,
}: {
  status: ContractStatus;
  audit: AuditLogEntry[];
}) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const auditChronological = useMemo(() => [...audit].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)), [audit]);

  const { currentIdx, special } = useMemo(() => {
    if (status === 'cancelled') return { currentIdx: -1, special: 'cancelled' as const };
    if (status === 'error') return { currentIdx: -1, special: 'error' as const };
    const idx = STAGE_ORDER.indexOf(status as (typeof STAGE_ORDER)[number]);
    return { currentIdx: Math.max(0, idx), special: null as null };
  }, [status]);

  const stageMeta = useMemo(
    () =>
      STAGE_ORDER.map((stage, idx) => ({
        stage,
        idx,
        entry: auditForStage(stage, auditChronological),
        done: special ? false : idx < currentIdx,
        current: special ? false : idx === currentIdx,
      })),
    [auditChronological, currentIdx, special],
  );

  if (special === 'cancelled') {
    return <p className="text-sm font-medium text-destructive">Contract cancelled — timeline unavailable</p>;
  }
  if (special === 'error') {
    return <p className="text-sm font-medium text-destructive">Error state — resolve to continue the pipeline</p>;
  }

  function scrollToAudit(entry: AuditLogEntry | null) {
    if (!entry) return;
    const el = document.getElementById(`audit-${entry.id}`);
    el?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  }

  return (
    <div className="w-full">
      {/* Mobile: vertical */}
      <div className="flex flex-col gap-0 md:hidden">
        {stageMeta.map(({ stage, idx, entry, done, current }) => (
          <div key={stage} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Node
                done={done}
                current={current}
                tooltip={stageTooltip(stage, entry, done, current)}
                onActivate={() => scrollToAudit(entry)}
                staggerMs={reducedMotion ? 0 : idx * 50}
              />
              {idx < STAGE_ORDER.length - 1 && (
                <div
                  className={cn(
                    'my-0.5 h-8 w-px shrink-0',
                    idx < currentIdx ? 'bg-accent-brand' : 'border-l border-dashed border-muted-foreground/40',
                  )}
                  aria-hidden
                />
              )}
            </div>
            <div className="pb-4 pt-0.5">
              <p className="text-xs font-medium leading-tight text-foreground">{formatStatus(stage)}</p>
              {entry && done && (
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{formatRelative(entry.occurred_at)}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: horizontal */}
      <div className="hidden md:flex md:w-full md:items-center md:justify-between md:gap-0">
        {stageMeta.map(({ stage, idx, entry, done, current }) => (
          <div key={stage} className="flex min-w-0 flex-1 items-center last:flex-none">
            <div className="flex shrink-0 flex-col items-center">
              <Node
                done={done}
                current={current}
                tooltip={stageTooltip(stage, entry, done, current)}
                onActivate={() => scrollToAudit(entry)}
                staggerMs={reducedMotion ? 0 : idx * 50}
              />
              <span className="mt-2 hidden max-w-[5.5rem] text-center text-[10px] font-medium leading-tight text-muted-foreground lg:block">
                {formatStatus(stage)}
              </span>
            </div>
            {idx < STAGE_ORDER.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 min-w-[8px] flex-1 rounded-full',
                  idx < currentIdx ? 'bg-accent-brand' : 'border-t border-dashed border-muted-foreground/40 bg-transparent',
                )}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 hidden text-center text-[10px] text-muted-foreground md:block lg:hidden">
        Tap a stage for details below
      </p>
    </div>
  );
}

function Node({
  done,
  current,
  tooltip,
  onActivate,
  staggerMs,
}: {
  done: boolean;
  current: boolean;
  tooltip: string;
  onActivate: () => void;
  staggerMs: number;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onActivate}
      className={cn(
        'relative h-[14px] w-[14px] shrink-0 rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        done && 'border-accent-brand bg-accent-brand shadow-sm',
        !done && !current && 'border-muted-foreground/45 bg-transparent',
        current && 'border-accent-brand bg-background',
      )}
      style={{
        animation: staggerMs ? `wf-stagger-node 0.45s ease-out ${staggerMs}ms both` : undefined,
      }}
    >
      {current && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full border border-accent-brand motion-safe:animate-wf-node-pulse"
          aria-hidden
        />
      )}
    </button>
  );
}
