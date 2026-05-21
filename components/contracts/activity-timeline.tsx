'use client';

import type { AuditLogEntry } from '@/types/db';
import { auditDotClass, describeAuditEntry } from '@/lib/audit-log-display';
import { formatStatus } from '@/lib/status-display';
import { formatTimestamp } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function ActivityTimeline({ audit }: { audit: AuditLogEntry[] }) {
  if (audit.length === 0) {
    return <p className="font-sans text-sm text-ink-500">No activity yet.</p>;
  }

  const ordered = [...audit].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  return (
    <TooltipProvider delayDuration={200}>
      <ol className="relative ms-2 space-y-0 border-l border-parchment-300 py-1 ps-8">
        {ordered.map((entry) => {
          const { title, detail, synthetic } = describeAuditEntry(entry);
          const statusHint =
            entry.to_status && entry.action === 'status_changed'
              ? formatStatus(entry.to_status)
              : entry.to_status && ['exhibitor_signed', 'docusign_completed', 'pdf_sent', 'released_to_accounting'].includes(entry.action)
                ? formatStatus(entry.to_status)
                : null;

          return (
            <li
              key={entry.id}
              id={entry.id > 0 ? `audit-${entry.id}` : undefined}
              className="relative pb-8 last:pb-0"
            >
              <span
                className={cn(
                  'absolute -left-[calc(0.5rem+13px)] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2',
                  auditDotClass(entry.action),
                )}
                aria-hidden
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default rounded-md px-1 py-0.5 transition-colors hover:bg-parchment-100/80">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans text-sm font-medium text-oak-800">{title}</p>
                      {statusHint ? (
                        <span className="rounded-full border border-parchment-300 bg-parchment-50 px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-ink-600">
                          {statusHint}
                        </span>
                      ) : null}
                      {synthetic ? (
                        <span className="font-sans text-[10px] text-ink-500">(from record dates)</span>
                      ) : null}
                    </div>
                    {detail ? <p className="mt-1 font-sans text-xs text-ink-600">{detail}</p> : null}
                    <p className="mt-1 font-sans text-xs text-ink-500">
                      {formatTimestamp(entry.occurred_at)}
                      {entry.actor_email ? (
                        <>
                          {' '}
                          · <span className="text-ink-600">{entry.actor_email}</span>
                        </>
                      ) : entry.action === 'exhibitor_signed' || entry.action === 'docusign_completed' ? (
                        <> · <span className="text-ink-600">DocuSign</span></>
                      ) : null}
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  <p className="font-medium text-foreground">{entry.action.replaceAll('_', ' ')}</p>
                  {entry.from_status || entry.to_status ? (
                    <p className="mt-1 text-muted-foreground">
                      {entry.from_status ? formatStatus(entry.from_status) : '—'} →{' '}
                      {entry.to_status ? formatStatus(entry.to_status) : '—'}
                    </p>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}
