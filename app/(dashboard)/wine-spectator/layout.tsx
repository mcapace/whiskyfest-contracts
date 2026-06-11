import { requireWineSpectatorPageAccess } from '@/lib/auth-wine-spectator';

export default async function WineSpectatorLayout({ children }: { children: React.ReactNode }) {
  await requireWineSpectatorPageAccess();
  return children;
}
