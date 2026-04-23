import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const accentRing: Record<'whisky' | 'fest' | 'amber' | 'emerald', string> = {
  whisky: 'text-whisky-800 bg-whisky-100/60 ring-whisky-300/30',
  fest: 'text-fest-800 bg-fest-100/90 ring-fest-300/30',
  amber: 'text-amber-700 bg-amber-100/60 ring-amber-300/30',
  emerald: 'text-emerald-700 bg-emerald-100/60 ring-emerald-300/30',
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
  accent: keyof typeof accentRing;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        'border-border/60 bg-bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md md:min-h-[7.5rem]',
        className,
      )}
    >
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1',
            accentRing[accent],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="wf-label-caps text-[0.65rem]">{label}</p>
          <p className="mt-1.5 font-serif text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}
