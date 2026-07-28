import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';

const accentRing: Record<'whisky' | 'fest' | 'amber' | 'emerald' | 'rose', string> = {
  whisky: 'text-whisky-800 bg-whisky-100/60 ring-whisky-300/30',
  fest: 'text-fest-800 bg-fest-100/90 ring-fest-300/30',
  amber: 'text-amber-700 bg-amber-100/60 ring-amber-300/30',
  emerald: 'text-emerald-700 bg-emerald-100/60 ring-emerald-300/30',
  rose: 'text-rose-800 bg-rose-100/70 ring-rose-300/35',
};

export function ARStatCard({
  href,
  title,
  count,
  cents,
  subtitle,
  active,
  icon: Icon,
  accent,
  activeRingClass,
}: {
  href: string;
  title: string;
  count: number;
  cents: number;
  subtitle?: string;
  active?: boolean;
  icon: LucideIcon;
  accent: keyof typeof accentRing;
  activeRingClass?: string;
}) {
  return (
    <Link href={href} className="group block h-full">
      <Card
        className={cn(
          'h-full border-border/60 bg-bg-surface transition-all hover:-translate-y-0.5 hover:shadow-md',
          active && (activeRingClass ?? 'ring-2 ring-fest-600/35'),
        )}
      >
        <CardContent className="flex items-start gap-4 p-5">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1 transition-transform group-hover:scale-105',
              accentRing[accent],
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="wf-label-caps text-[0.65rem]">{title}</p>
            <p className="mt-1.5 font-serif text-2xl font-semibold tabular-nums tracking-tight">{count}</p>
            <p className="mt-1 font-mono text-sm tabular-nums text-foreground">{formatCurrency(cents)}</p>
            {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
