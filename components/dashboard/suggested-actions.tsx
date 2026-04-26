'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Bell, Sparkles } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import type { ContractWithTotals } from '@/types/db';

type Suggestion = {
  key: string;
  icon: typeof Bell;
  label: string;
  detail: string;
  onClick: () => void;
};

function daysSinceSent(sentAt: string | null | undefined): number {
  if (!sentAt) return 0;
  return differenceInDays(new Date(), new Date(sentAt));
}

export function SuggestedActions({
  contracts,
  viewer,
}: {
  contracts: ContractWithTotals[];
  viewer: {
    role: string;
    is_events_team: boolean;
    is_admin: boolean;
    sales_rep_id: string | null;
  };
}) {
  const router = useRouter();

  const suggestions = useMemo(() => {
    const out: Suggestion[] = [];
    const now = new Date();

    for (const c of contracts) {
      if (c.status === 'sent' && c.sales_rep_id && viewer.sales_rep_id && c.sales_rep_id === viewer.sales_rep_id) {
        const d = daysSinceSent(c.sent_at);
        if (d >= 5) {
          out.push({
            key: `remind-${c.id}`,
            icon: Bell,
            label: `Send reminder for ${c.exhibitor_company_name}`,
            detail: `Out for signature · ${d} day${d === 1 ? '' : 's'} since sent`,
            onClick: () => {
              void fetch(`/api/contracts/${c.id}/send-reminder`, { method: 'POST' }).then(() => router.refresh());
            },
          });
        }
      }
      if (
        c.status === 'pending_events_review' &&
        (viewer.is_admin || viewer.is_events_team)
      ) {
        const d = differenceInDays(now, new Date(c.created_at));
        if (d >= 3) {
          out.push({
            key: `review-${c.id}`,
            icon: AlertCircle,
            label: `Review ${c.exhibitor_company_name}`,
            detail: `Events queue · waiting ${d} day${d === 1 ? '' : 's'}`,
            onClick: () => router.push(`/contracts/${c.id}`),
          });
        }
      }
    }

    return out.slice(0, 5);
  }, [contracts, router, viewer.is_admin, viewer.is_events_team, viewer.sales_rep_id]);

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-amber-200/60 bg-gradient-to-br from-parchment-50 to-amber-50/40 shadow-wf-editorial-sm">
      <CardContent className="p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-xl font-medium text-oak-800">
          <Sparkles className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          Suggested for you
        </h3>
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={s.onClick}
                className="w-full rounded-lg p-3 text-left transition-colors hover:bg-parchment-100/90"
              >
                <div className="flex items-start gap-3">
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  <div>
                    <p className="font-sans text-sm font-medium text-oak-800">{s.label}</p>
                    <p className="mt-0.5 font-sans text-xs text-ink-500">{s.detail}</p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
