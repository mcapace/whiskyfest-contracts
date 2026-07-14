'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePortalKind } from '@/components/portal/portal-context';
import { BIG_SMOKE_SHORT_LABEL } from '@/lib/big-smoke-copy';
import { NYWE_SHORT_LABEL } from '@/lib/nywe-copy';
import {
  isAccountingPath,
  isBigSmokeAccountingPathname,
  isBigSmokePath,
  isNyweAccountingPathname,
  isWineSpectatorPath,
} from '@/lib/product-portal';
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

  const portalLabel = (() => {
    if (portalKind === 'big_smoke' || isBigSmokePath(pathname)) {
      return isBigSmokeAccountingPathname(pathname) ||
        (portalKind === 'big_smoke' && isAccountingPath(pathname))
        ? `Accounting · ${BIG_SMOKE_SHORT_LABEL}`
        : `${BIG_SMOKE_SHORT_LABEL} · Contracts`;
    }
    if (portalKind === 'nywe' || isWineSpectatorPath(pathname)) {
      return isNyweAccountingPathname(pathname) || (portalKind === 'nywe' && isAccountingPath(pathname))
        ? `Accounting · ${NYWE_SHORT_LABEL}`
        : `${NYWE_SHORT_LABEL} · Contracts`;
    }
    if (isAccountingPath(pathname)) return 'Accounting · WhiskyFest';
    return 'WhiskyFest · Contracts';
  })();

  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-border/50 bg-bg-surface-raised/90 backdrop-blur-md supports-[backdrop-filter]:bg-bg-surface-raised/75',
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6 lg:max-w-none lg:px-10">
        <div className="min-w-0">
          {title ? (
            <h1 className="truncate font-serif text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          ) : (
            <p className="wf-label-caps text-[0.65rem] text-muted-foreground">{portalLabel}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">{endSlot}</div>
      </div>
    </header>
  );
}
