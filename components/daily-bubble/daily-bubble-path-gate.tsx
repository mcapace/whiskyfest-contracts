'use client';

import { usePathname } from 'next/navigation';
import { isWineSpectatorPath } from '@/lib/product-portal';

/** Hides the daily bubble on Wine Spectator / NYWE routes (client pathname is reliable; middleware headers are not). */
export function DailyBubblePathGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (isWineSpectatorPath(pathname)) return null;
  return children;
}
