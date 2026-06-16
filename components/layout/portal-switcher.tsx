'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  isAccountingPath,
  isWineSpectatorPath,
  productDisplayLabel,
  PRODUCT_WINE_SPECTATOR,
  PRODUCT_WHISKYFEST,
} from '@/lib/product-portal';

type PortalKey = 'whiskyfest' | 'wine_spectator' | 'accounting';

export function PortalSwitcher({
  pathname,
  canWineSpectator,
  canAccounting,
}: {
  pathname: string;
  canWineSpectator: boolean;
  canAccounting: boolean;
}) {
  const active: PortalKey = isAccountingPath(pathname)
    ? 'accounting'
    : isWineSpectatorPath(pathname)
      ? 'wine_spectator'
      : 'whiskyfest';

  const items: { key: PortalKey; href: string; label: string; show: boolean }[] = [
    { key: 'whiskyfest', href: '/', label: productDisplayLabel(PRODUCT_WHISKYFEST), show: true },
    {
      key: 'wine_spectator',
      href: '/wine-spectator',
      label: 'NYWE',
      show: canWineSpectator,
    },
    { key: 'accounting', href: '/accounting', label: 'Accounting', show: canAccounting },
  ];

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
      {items
        .filter((i) => i.show)
        .map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              'rounded-lg px-2.5 py-2 text-center text-[11px] font-semibold tracking-wide transition-all',
              active === item.key
                ? 'bg-white text-foreground shadow-sm ring-1 ring-black/[0.06] dark:bg-bg-surface-raised dark:ring-white/10'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
    </div>
  );
}
