import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DashboardHero({
  contractsCount,
  eventsCount,
  supportedRepNames,
  completionLabel,
  progressPct,
  className,
}: {
  contractsCount: number;
  eventsCount: number;
  supportedRepNames: string[];
  completionLabel: string;
  progressPct: number;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'border-b border-border/50 pb-8',
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-3xl">
          <p className="wf-label-caps mb-2 text-brass-700 dark:text-brass-400">M. Shanken Communications</p>
          <h1 className="wf-display-serif text-[2rem] leading-tight text-foreground sm:text-4xl md:text-[2.75rem]">
            WhiskyFest 2026 Contract Pipeline
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {contractsCount} total contracts · {eventsCount} active event{eventsCount !== 1 ? 's' : ''}
          </p>
          {supportedRepNames.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 shrink-0 text-accent-brand" />
              <span>
                Supporting:{' '}
                <span className="font-medium text-foreground">{supportedRepNames.join(', ')}</span>
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="active:scale-[0.98]">
            <Link href="/contracts">View all</Link>
          </Button>
          <Button asChild className="active:scale-[0.98]">
            <Link href="/contracts/new">
              <Plus className="h-4 w-4" /> New Contract
            </Link>
          </Button>
        </div>
      </div>
      <div className="mt-8 max-w-2xl">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="wf-label-caps text-[0.6rem]">Pipeline completion</span>
          <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{completionLabel}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-brand to-primary transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}
