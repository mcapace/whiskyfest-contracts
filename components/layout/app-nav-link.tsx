'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppNavLink({
  href,
  active,
  icon: Icon,
  label,
  badge,
  disabled,
  disabledTitle,
  tourId,
}: {
  href: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
  badge?: number;
  disabled?: boolean;
  disabledTitle?: string;
  tourId?: string;
}) {
  const className = cn(
    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all',
    active
      ? 'bg-white text-foreground shadow-sm ring-1 ring-black/[0.06] dark:bg-bg-surface-raised dark:ring-white/10'
      : 'text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/5',
    disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
  );

  const inner = (
    <>
      <Icon
        className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-accent-brand' : 'text-muted-foreground/80 group-hover:text-foreground')}
        strokeWidth={1.75}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge != null && badge > 0 ? (
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-800 dark:text-amber-200">
          {badge}
        </span>
      ) : null}
    </>
  );

  if (disabled) {
    return (
      <span title={disabledTitle} className={className}>
        {inner}
      </span>
    );
  }

  return (
    <Link href={href} data-tour={tourId} className={className}>
      {inner}
    </Link>
  );
}
