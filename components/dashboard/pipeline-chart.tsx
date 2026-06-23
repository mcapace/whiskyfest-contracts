'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { pipelineBarColor } from '@/lib/status-display';
import { formatCurrency } from '@/lib/utils';
import type { PipelineRow } from '@/lib/event-metrics';

export function PipelineChart({ data }: { data: PipelineRow[] }) {
  const router = useRouter();
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        barColor: pipelineBarColor(d.key),
        rightLabel: `${d.count} contracts · ${formatCurrency(d.totalCents)}`,
      })),
    [data]
  );

  const max = Math.max(1, ...chartData.map((d) => d.count));
  const empty = chartData.every((d) => d.count === 0);

  if (empty) {
    return <p className="text-sm text-ink-500">No contracts yet.</p>;
  }

  const legend = chartData.map((d) => ({ key: d.key, label: d.label, color: d.barColor }));

  return (
    <div className="space-y-4">
      <div className="h-[360px] w-full min-h-[360px] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={360}>
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
      <ul className="flex flex-wrap gap-x-4 gap-y-2 font-sans text-xs text-ink-600" aria-label="Pipeline stage colors">
        {legend.map((item) => (
          <li key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
