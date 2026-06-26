'use client';

import { usePathname } from 'next/navigation';
import { usePortalKind } from '@/components/portal/portal-context';
import { isWineSpectatorPath } from '@/lib/product-portal';

/** Hides the WhiskyFest daily bubble on NYWE / Wine Spectator routes. */
export function DailyBubblePathGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const portalKind = usePortalKind();

  if (portalKind === 'nywe' || isWineSpectatorPath(pathname)) {
    return null;
  }

  return <>{children}</>;
}
