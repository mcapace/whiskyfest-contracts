import type { AuditLogEntry } from '@/types/db';
import { formatTimestamp } from '@/lib/utils';

function describe(entry: AuditLogEntry): string {
  const action = entry.action.replaceAll('_', ' ');
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export function ActivityTimeline({ audit }: { audit: AuditLogEntry[] }) {
  if (audit.length === 0) {
    return <p className="text-sm text-ink-500">No activity yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-parchment-300 pl-6">
      {[...audit].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)).map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[29px] top-1.5 h-3 w-3 rounded-full border border-parchment-300 bg-amber-500" />
          <p className="font-sans text-sm font-medium text-oak-800">{describe(entry)}</p>
          <p className="text-xs text-ink-500">
            {formatTimestamp(entry.occurred_at)}{entry.actor_email ? ` · ${entry.actor_email}` : ''}
          </p>
        </li>
      ))}
    </ol>
  );
}
