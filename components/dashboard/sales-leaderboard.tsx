'use client';

import { useState } from 'react';
import { formatCurrency, cn } from '@/lib/utils';
import type { LeaderboardRow } from '@/lib/event-metrics';
import { Card, CardContent } from '@/components/ui/card';

export function SalesLeaderboard({ reps }: { reps: LeaderboardRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleReps = expanded ? reps : reps.slice(0, 3);
  const hasMore = reps.length > 3;

  return (
    <Card className="bg-parchment-50">
      <CardContent className="p-6">
        <h3 className="font-display text-xl font-medium text-oak-800">Sales Leaderboard</h3>
        {reps.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">Leaderboard appears once contracts are signed.</p>
        ) : (
          <>
            <div
              className={cn(
                'mt-5 overflow-hidden transition-[max-height] duration-200 ease-out',
                expanded ? 'max-h-[2000px]' : 'max-h-[320px]',
              )}
            >
              <ol className="space-y-4">
                {visibleReps.map((rep, idx) => (
                  <li
                    key={rep.email}
                    className="flex items-baseline justify-between gap-3 border-b border-parchment-200/80 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="font-display text-2xl tabular-nums text-amber-600">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <p className="truncate font-sans font-medium text-oak-800">{rep.name}</p>
                        <p className="font-sans text-xs text-ink-500">{rep.contractsSigned} contracts signed</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg tabular-nums text-oak-800">{formatCurrency(rep.totalValueCents)}</p>
                      <p className="font-sans text-xs text-ink-500">contracted</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            {hasMore ? (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-4 text-left text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                {expanded ? 'Show less' : `Show all ${reps.length}`}
              </button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
