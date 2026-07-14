'use client';

import { usePathname } from 'next/navigation';
import { usePortalKind } from '@/components/portal/portal-context';
import { isBigSmokePath, isWineSpectatorPath } from '@/lib/product-portal';

/** Hides the WhiskyFest daily bubble on NYWE / Big Smoke routes. */
export function DailyBubblePathGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const portalKind = usePortalKind();

  if (
    portalKind === 'nywe' ||
    portalKind === 'big_smoke' ||
    isWineSpectatorPath(pathname) ||
    isBigSmokePath(pathname)
  ) {
    return null;
  }

  return <>{children}</>;
}
