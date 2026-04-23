import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

export function ARStatCard({
  href,
  title,
  count,
  cents,
  subtitle,
  active,
}: {
  href: string;
  title: string;
  count: number;
  cents: number;
  subtitle?: string;
  active?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className={cn(
          'border-b border-border/50 pb-5 pt-2 transition-colors md:border md:border-border/60 md:rounded-lg md:bg-bg-surface md:p-5 md:shadow-sm md:hover:-translate-y-0.5 md:hover:shadow-md',
          active && 'md:ring-2 md:ring-accent-brand/35',
        )}
      >
        <p className="wf-label-caps text-[0.6rem]">{title}</p>
        <p className="mt-2 font-serif text-2xl font-semibold tabular-nums md:text-3xl">{count}</p>
        <p className="mt-1 font-mono text-lg tabular-nums text-foreground md:text-xl">{formatCurrency(cents)}</p>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </Link>
  );
}
