import Link from 'next/link';
import { CheckCircle2, Clock3, FileCheck2, FilePenLine, FileX2, Send, ShieldCheck } from 'lucide-react';
import { describeAuditAction, type ActivityRow } from '@/lib/event-metrics';
import { formatRelative } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

function ActivityIcon({ action }: { action: string }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0 text-ink-500';
  switch (action) {
    case 'contract_created':
      return <FilePenLine className={className} aria-hidden />;
    case 'events_approved':
    case 'discount_approved':
      return <ShieldCheck className={className} aria-hidden />;
    case 'docusign_sent':
      return <Send className={className} aria-hidden />;
    case 'exhibitor_signed':
    case 'countersigner_signed':
      return <FileCheck2 className={className} aria-hidden />;
    case 'voided':
    case 'cancelled':
      return <FileX2 className={className} aria-hidden />;
    case 'released_to_accounting':
    case 'invoice_sent':
    case 'paid':
      return <CheckCircle2 className={className} aria-hidden />;
    default:
      return <Clock3 className={className} aria-hidden />;
  }
}

export function RecentActivityFeed({ activities, title }: { activities: ActivityRow[]; title?: string }) {
  return (
    <Card className="bg-parchment-50">
      <CardContent className="p-6">
        <h3 className="font-display text-xl font-medium text-oak-800">{title ?? 'Recent Activity'}</h3>
        {activities.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">Activity will appear here as contracts move through the system.</p>
        ) : (
          <ul className="mt-5 space-y-4">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <ActivityIcon action={a.action} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-ink-700">
                    <span className="font-medium text-oak-800">{a.actor}</span>{' '}
                    <span>{describeAuditAction(a.action)}</span>{' '}
                    {a.contractId && a.contractName ? (
                      <Link href={`/contracts/${a.contractId}`} className="font-medium text-amber-700 hover:underline">
                        {a.contractName}
                      </Link>
                    ) : null}
                  </p>
                  <p className="mt-1 font-sans text-xs text-ink-500">{formatRelative(a.occurredAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
