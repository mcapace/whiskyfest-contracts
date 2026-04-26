'use client';

import type { AuditLogEntry } from '@/types/db';
import { formatTimestamp } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function describe(entry: AuditLogEntry): string {
  const action = entry.action.replaceAll('_', ' ');
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function dotClass(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('void') || a.includes('cancel') || a.includes('error')) return 'border-danger-base bg-danger-bg text-danger-base';
  if (a.includes('signed') || a.includes('executed') || a.includes('released') || a.includes('completed'))
    return 'border-success-base bg-success-bg text-success-base';
  if (a.includes('sent') || a.includes('docusign') || a.includes('submitted')) return 'border-info-base bg-info-bg text-info-base';
  if (a.includes('approved') || a.includes('discount')) return 'border-amber-600 bg-parchment-100 text-amber-700';
  return 'border-parchment-300 bg-parchment-50 text-ink-500';
}

export function ActivityTimeline({ audit }: { audit: AuditLogEntry[] }) {
  if (audit.length === 0) {
    return <p className="font-sans text-sm text-ink-500">No activity yet.</p>;
  }

  const ordered = [...audit].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  return (
    <TooltipProvider delayDuration={200}>
      <ol className="relative ms-2 space-y-0 border-l border-parchment-300 py-1 ps-8">
        {ordered.map((entry) => (
          <li key={entry.id} className="relative pb-8 last:pb-0">
            <span
              className={cn(
                'absolute -left-[calc(0.5rem+13px)] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2',
                dotClass(entry.action),
              )}
              aria-hidden
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default rounded-md px-1 py-0.5 transition-colors hover:bg-parchment-100/80">
                  <p className="font-sans text-sm font-medium text-oak-800">{describe(entry)}</p>
                  <p className="mt-1 font-sans text-xs text-ink-500">
                    {formatTimestamp(entry.occurred_at)}
                    {entry.actor_email ? (
                      <>
                        {' '}
                        · <span className="text-ink-600">{entry.actor_email}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <p className="font-medium text-foreground">{entry.action.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-muted-foreground">Full metadata is available in the admin audit log when needed.</p>
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ol>
    </TooltipProvider>
  );
}
