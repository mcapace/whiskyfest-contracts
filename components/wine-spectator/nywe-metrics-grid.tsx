import { CheckCircle2, Clock, DollarSign, PenLine } from 'lucide-react';
import { DashboardStatCard } from '@/components/dashboard/stat-card';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { NyweDashboardMetrics } from '@/lib/nywe-dashboard-metrics';

export function NyweMetricsGrid({ metrics, compact }: { metrics: NyweDashboardMetrics; compact?: boolean }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2',
        compact ? 'xl:grid-cols-4' : 'lg:grid-cols-4',
      )}
      data-tour="dashboard-stats"
    >
      <DashboardStatCard
        icon={CheckCircle2}
        label="Executed"
        value={formatCurrency(metrics.executedRevenueCents)}
        sub={`${metrics.executedCount} contracts · ${metrics.completionPct}% of roster`}
        accent="emerald"
      />
      <DashboardStatCard
        icon={Clock}
        label="In DocuSign"
        value={formatCurrency(metrics.inFlightRevenueCents)}
        sub={`${metrics.waitingOnWineryCount} with winery · ${metrics.readyToCountersignCount} ready to countersign`}
        accent="amber"
      />
      <DashboardStatCard
        icon={PenLine}
        label="Booked (signed)"
        value={formatCurrency(metrics.bookedRevenueCents)}
        sub="Countersigned and released to accounting"
        accent="whisky"
      />
      <DashboardStatCard
        icon={DollarSign}
        label="Total pipeline"
        value={formatCurrency(metrics.pipelineRevenueCents)}
        sub={`${metrics.totalLicenses} contracts · ${metrics.rosterWineries} roster wineries · ${metrics.daysToEvent} days to event`}
        accent="fest"
      />
    </div>
  );
}
