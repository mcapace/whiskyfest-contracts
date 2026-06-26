'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePortalKind } from '@/components/portal/portal-context';
import { isAccountingPath, isNyweAccountingPathname, isWineSpectatorPath } from '@/lib/product-portal';
import { NYWE_SHORT_LABEL } from '@/lib/nywe-copy';
import { cn } from '@/lib/utils';

/**
 * Sticky top chrome — right slot used by command palette trigger and theme toggle.
 */
export function Topbar({
  title,
  className,
  endSlot,
}: {
  title?: string | null;
  className?: string;
  endSlot?: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const portalKind = usePortalKind();
  const nywePortal = portalKind === 'nywe';
  const portalLabel = nywePortal
    ? isNyweAccountingPathname(pathname, 'nywe')
      ? `Accounting · ${NYWE_SHORT_LABEL}`
      : `${NYWE_SHORT_LABEL} · Contracts`
    : isWineSpectatorPath(pathname)
      ? `${NYWE_SHORT_LABEL} · Contracts`
      : isNyweAccountingPathname(pathname)
        ? `Accounting · ${NYWE_SHORT_LABEL}`
        : isAccountingPath(pathname)
          ? 'Accounting · WhiskyFest'
          : 'WhiskyFest · Contracts';

  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b backdrop-blur-md',
        nywePortal
          ? 'border-rose-900/25 bg-rose-950/95 supports-[backdrop-filter]:bg-rose-950/90'
          : 'border-border/50 bg-bg-surface-raised/90 supports-[backdrop-filter]:bg-bg-surface-raised/75',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6 lg:max-w-none lg:px-10">
        <div className="min-w-0">
          {title ? (
            <h1
              className={cn(
                'truncate font-serif text-lg font-semibold tracking-tight',
                nywePortal ? 'text-parchment-50' : 'text-foreground',
              )}
            >
              {title}
            </h1>
          ) : (
            <p className={cn('wf-label-caps text-[0.65rem]', nywePortal ? 'text-brass-200' : 'text-muted-foreground')}>
              {portalLabel}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">{endSlot}</div>
      </div>
    </header>
  );
}
