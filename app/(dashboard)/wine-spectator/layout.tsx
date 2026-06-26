import type { Metadata } from 'next';
import { requireWineSpectatorPageAccess } from '@/lib/auth-wine-spectator';
import { NYWE_LOGIN_TAGLINE, NYWE_PORTAL_TITLE } from '@/lib/nywe-copy';

export const metadata: Metadata = {
  title: NYWE_PORTAL_TITLE,
  description: NYWE_LOGIN_TAGLINE,
};

export default async function WineSpectatorLayout({ children }: { children: React.ReactNode }) {
  await requireWineSpectatorPageAccess();
  return children;
}
