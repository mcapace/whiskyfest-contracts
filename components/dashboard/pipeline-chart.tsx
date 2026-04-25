'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { PipelineRow } from '@/lib/event-metrics';

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B5D4A',
  pending_events_review: '#9A6914',
  approved: '#1B4965',
  sent: '#C9892F',
  partially_signed: '#A66B1F',
  signed: '#2D6A4F',
  executed: '#2A1F0F',
};

export function PipelineChart({ data }: { data: PipelineRow[] }) {
  const router = useRouter();
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        barColor: STATUS_COLORS[d.key] ?? '#6B5D4A',
        rightLabel: `${d.count} contracts · ${formatCurrency(d.totalCents)}`,
      })),
    [data]
  );

  const max = Math.max(1, ...chartData.map((d) => d.count));
  const empty = chartData.every((d) => d.count === 0);

  if (empty) {
    return <p className="text-sm text-ink-500">No contracts yet.</p>;
  }

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 180, left: 12, bottom: 8 }} barGap={14}>
          <XAxis type="number" domain={[0, max]} hide />
          <YAxis type="category" dataKey="label" width={120} tick={{ fill: '#3E3019', fontSize: 12 }} />
          <Bar
            dataKey="count"
            radius={[6, 6, 6, 6]}
            cursor="pointer"
            onClick={(entry) => {
              if (!entry || typeof entry !== 'object' || !('href' in entry)) return;
              const href = (entry as { href?: string }).href;
              if (href) router.push(href);
            }}
          >
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={entry.barColor} />
            ))}
            <LabelList
              dataKey="rightLabel"
              position="right"
              offset={10}
              className="fill-ink-700 font-sans text-xs tabular-nums"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
