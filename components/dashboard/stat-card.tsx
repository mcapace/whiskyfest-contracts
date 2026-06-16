import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const accentStyles: Record<'neutral' | 'whisky' | 'fest' | 'amber' | 'emerald', string> = {
  neutral: 'text-slate-600 bg-slate-100',
  whisky: 'text-whisky-800 bg-whisky-100/80',
  fest: 'text-fest-700 bg-fest-50',
  amber: 'text-amber-800 bg-amber-50',
  emerald: 'text-emerald-700 bg-emerald-50',
};

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  accent: keyof typeof accentStyles;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-white p-4 shadow-sm transition hover:border-border hover:shadow-md dark:bg-bg-surface',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', accentStyles[accent])}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}
