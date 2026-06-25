import { CalendarDays, DollarSign, PenLine, Send, TrendingUp, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { NyweDashboardMetrics } from '@/lib/nywe-dashboard-metrics';

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: typeof DollarSign;
  tone: 'rose' | 'violet' | 'orange' | 'emerald' | 'slate';
};

const toneStyles: Record<MetricCardProps['tone'], string> = {
  rose: 'from-rose-950/5 to-rose-900/10 border-rose-200/80 text-rose-950',
  violet: 'from-violet-950/5 to-violet-900/10 border-violet-200/80 text-violet-950',
  orange: 'from-orange-950/5 to-orange-900/10 border-orange-200/80 text-orange-950',
  emerald: 'from-emerald-950/5 to-emerald-900/10 border-emerald-200/80 text-emerald-950',
  slate: 'from-slate-950/5 to-slate-900/10 border-border/70 text-foreground',
};

const iconStyles: Record<MetricCardProps['tone'], string> = {
  rose: 'bg-rose-100 text-rose-800',
  violet: 'bg-violet-100 text-violet-800',
  orange: 'bg-orange-100 text-orange-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  slate: 'bg-muted text-muted-foreground',
};

function MetricCard({ label, value, detail, icon: Icon, tone }: MetricCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-shadow hover:shadow-md',
        toneStyles[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
          <p className="mt-2 font-serif text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
          <p className="mt-1.5 text-sm opacity-80">{detail}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconStyles[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  );
}

export function NyweMetricsGrid({ metrics, compact }: { metrics: NyweDashboardMetrics; compact?: boolean }) {
  return (
    <div className={cn('grid gap-4', compact ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6')}>
      <MetricCard
        label="Total pipeline"
        value={formatCurrency(metrics.pipelineRevenueCents)}
        detail={`${metrics.totalLicenses} licenses · ${metrics.rosterWineries} on roster`}
        icon={TrendingUp}
        tone="slate"
      />
      <MetricCard
        label="Executed revenue"
        value={formatCurrency(metrics.executedRevenueCents)}
        detail={`${metrics.executedCount} fully executed · ${metrics.completionPct}% of roster`}
        icon={DollarSign}
        tone="emerald"
      />
      <MetricCard
        label="Booked (signed)"
        value={formatCurrency(metrics.bookedRevenueCents)}
        detail="Countersigned or released to accounting"
        icon={PenLine}
        tone="rose"
      />
      <MetricCard
        label="In DocuSign"
        value={formatCurrency(metrics.inFlightRevenueCents)}
        detail={`${metrics.waitingOnWineryCount} with winery · ${metrics.readyToCountersignCount} to countersign`}
        icon={Send}
        tone="violet"
      />
      <MetricCard
        label="Roster wineries"
        value={String(metrics.rosterWineries)}
        detail={`${metrics.totalLicenses} licenses in system`}
        icon={Users}
        tone="slate"
      />
      <MetricCard
        label="Days to event"
        value={String(metrics.daysToEvent)}
        detail={metrics.eventDateLabel}
        icon={CalendarDays}
        tone="orange"
      />
    </div>
  );
}
