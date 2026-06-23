'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isWineSpectatorPath } from '@/lib/product-portal';

/** Hides the daily bubble on Wine Spectator / NYWE routes after hydration (avoids pathname SSR mismatch). */
export function DailyBubblePathGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(!isWineSpectatorPath(pathname));
  }, [pathname]);

  if (!visible) return null;
  return <>{children}</>;
}
