'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Clock3, FileCheck2, FilePenLine, FileX2, Send, ShieldCheck } from 'lucide-react';
import { describeAuditAction, type ActivityRow } from '@/lib/event-metrics';
import { formatRelative, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { subscribeToActivity } from '@/lib/realtime-client';

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

const ACTIVITY_CAP = 15;

export function RecentActivityFeed({ activities, title }: { activities: ActivityRow[]; title?: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const prevHead = useRef<string | undefined>(undefined);
  const [enterPulse, setEnterPulse] = useState(0);

  useEffect(() => {
    const off = subscribeToActivity(() => {
      router.refresh();
    });
    return () => off();
  }, [router]);

  const headId = activities[0]?.id;
  useEffect(() => {
    if (prevHead.current !== undefined && headId && headId !== prevHead.current && !reduce) {
      setEnterPulse((n) => n + 1);
    }
    prevHead.current = headId;
  }, [headId, reduce]);

  const capped = activities.slice(0, ACTIVITY_CAP);
  const visible = expanded ? capped : capped.slice(0, 3);
  const hasMore = capped.length > 3;

  return (
    <Card className="bg-parchment-50">
      <CardContent className="p-6">
        <h3 className="font-display text-xl font-medium text-oak-800">{title ?? 'Recent Activity'}</h3>
        {activities.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">Activity will appear here as contracts move through the system.</p>
        ) : (
          <>
            <div
              className={cn(
                'mt-5 overflow-hidden transition-[max-height] duration-200 ease-out',
                expanded ? 'max-h-[2000px]' : 'max-h-[280px]',
              )}
            >
              <motion.ul className="space-y-4" layout={!reduce}>
                {visible.map((a, idx) => (
                  <motion.li
                    key={idx === 0 ? `${a.id}-${enterPulse}` : a.id}
                    layout={!reduce}
                    initial={!reduce && idx === 0 && enterPulse > 0 ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex gap-3 text-sm"
                  >
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
                  </motion.li>
                ))}
              </motion.ul>
            </div>
            {hasMore ? (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-4 text-left text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
