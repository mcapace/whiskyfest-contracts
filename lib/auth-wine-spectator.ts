import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireContractActorForPage, type PageContractActor } from '@/lib/auth-contract';
import { canAccessWineSpectator } from '@/lib/wine-spectator-access';

/** Gate Wine Spectator pages: admin, events team, or Susannah Nolan. */
export async function requireWineSpectatorPageAccess(): Promise<PageContractActor> {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');
  if (!canAccessWineSpectator(session.user)) redirect('/');

  return requireContractActorForPage();
}
