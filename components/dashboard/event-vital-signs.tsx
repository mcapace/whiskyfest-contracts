import { formatCurrency } from '@/lib/utils';
import type { EventVitalSigns } from '@/lib/event-metrics';
import { Card, CardContent } from '@/components/ui/card';

function ProgressTrack({ value, tone }: { value: number; tone: 'amber' | 'copper' }) {
  const color = tone === 'amber' ? 'bg-amber-500' : 'bg-copper-500';
  return (
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-parchment-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`${color} h-full rounded-full transition-[width] duration-500`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function EventVitalSignsSection({ metrics }: { metrics: EventVitalSigns }) {
  return (
    <section className="space-y-4" aria-labelledby="event-vital-signs-heading">
      <h2 id="event-vital-signs-heading" className="font-display text-2xl font-medium text-oak-800">
        Event Vital Signs
      </h2>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-parchment-50">
          <CardContent className="p-8">
            <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-ink-500">Contracted Revenue</p>
            <p className="mt-3 font-display text-5xl font-medium tabular-nums text-oak-800">{formatCurrency(metrics.contractedRevenueCents)}</p>
            <p className="mt-2 font-sans text-sm text-ink-700">of {formatCurrency(metrics.targetRevenueCents)} target</p>
            <ProgressTrack value={metrics.contractedRevenuePct} tone="amber" />
          </CardContent>
        </Card>

        <Card className="bg-parchment-50">
          <CardContent className="p-8">
            <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-ink-500">Contracts Signed</p>
            <p className="mt-3 font-display text-5xl font-medium tabular-nums text-oak-800">{metrics.signedContracts}</p>
            <p className="mt-2 font-sans text-sm text-ink-700">of {metrics.signedTarget} booth target</p>
            <ProgressTrack value={metrics.signedPct} tone="copper" />
          </CardContent>
        </Card>

        <Card className="bg-parchment-50">
          <CardContent className="p-8">
            <p className="font-sans text-xs font-medium uppercase tracking-[0.2em] text-ink-500">Days to Event</p>
            <p className="mt-3 font-display text-5xl font-medium tabular-nums text-oak-800">{metrics.daysToEvent}</p>
            <p className="mt-2 font-sans text-sm text-ink-700">{metrics.eventDateLabel}</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
