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
  featured?: boolean;
};

const toneStyles: Record<MetricCardProps['tone'], string> = {
  rose: 'from-rose-950/[0.04] to-rose-900/[0.08] border-rose-200/70',
  violet: 'from-violet-950/[0.04] to-violet-900/[0.08] border-violet-200/70',
  orange: 'from-orange-950/[0.04] to-orange-900/[0.08] border-orange-200/70',
  emerald: 'from-emerald-950/[0.04] to-emerald-900/[0.08] border-emerald-200/70',
  slate: 'from-slate-950/[0.03] to-slate-900/[0.06] border-border/60',
};

const iconStyles: Record<MetricCardProps['tone'], string> = {
  rose: 'bg-rose-100/90 text-rose-800 ring-rose-200/80',
  violet: 'bg-violet-100/90 text-violet-800 ring-violet-200/80',
  orange: 'bg-orange-100/90 text-orange-800 ring-orange-200/80',
  emerald: 'bg-emerald-100/90 text-emerald-800 ring-emerald-200/80',
  slate: 'bg-muted/80 text-muted-foreground ring-border/60',
};

function MetricCard({ label, value, detail, icon: Icon, tone, featured }: MetricCardProps) {
  return (
    <div
      className={cn(
        'flex min-h-[9.5rem] flex-col justify-between rounded-2xl border bg-gradient-to-br p-6 shadow-sm transition-shadow hover:shadow-md lg:min-h-[10.25rem] lg:p-7',
        toneStyles[tone],
        featured && 'lg:min-h-[11rem]',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
            iconStyles[tone],
          )}
        >
          <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <p
          className={cn(
            'font-serif font-semibold tabular-nums tracking-tight text-foreground',
            featured ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl',
          )}
        >
          {value}
        </p>
        <p className="max-w-[20rem] text-sm leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function NyweMetricsGrid({ metrics, compact }: { metrics: NyweDashboardMetrics; compact?: boolean }) {
  const primary = (
    <>
      <MetricCard
        label="Total pipeline"
        value={formatCurrency(metrics.pipelineRevenueCents)}
        detail={`${metrics.totalLicenses} contracts across ${metrics.rosterWineries} roster wineries`}
        icon={TrendingUp}
        tone="slate"
        featured
      />
      <MetricCard
        label="Executed revenue"
        value={formatCurrency(metrics.executedRevenueCents)}
        detail={`${metrics.executedCount} fully executed · ${metrics.completionPct}% of roster`}
        icon={DollarSign}
        tone="emerald"
        featured
      />
      <MetricCard
        label="In DocuSign"
        value={formatCurrency(metrics.inFlightRevenueCents)}
        detail={`${metrics.waitingOnWineryCount} with winery · ${metrics.readyToCountersignCount} ready to countersign`}
        icon={Send}
        tone="violet"
        featured
      />
    </>
  );

  const secondary = (
    <>
      <MetricCard
        label="Booked (signed)"
        value={formatCurrency(metrics.bookedRevenueCents)}
        detail="Countersigned and released to accounting"
        icon={PenLine}
        tone="rose"
      />
      <MetricCard
        label="Roster wineries"
        value={String(metrics.rosterWineries)}
        detail={`${metrics.totalLicenses} contracts in the system`}
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
    </>
  );

  if (compact) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {primary}
        {secondary}
      </div>
    );
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">{primary}</div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">{secondary}</div>
    </div>
  );
}
