import type { Metadata } from 'next';
import { requireWineSpectatorPageAccess } from '@/lib/auth-wine-spectator';

export const metadata: Metadata = {
  title: 'NYWE Contracts | Wine Spectator',
  description: 'New York Wine Experience vendor license management — M. Shanken Communications',
};

export default async function WineSpectatorLayout({ children }: { children: React.ReactNode }) {
  await requireWineSpectatorPageAccess();
  return children;
}
