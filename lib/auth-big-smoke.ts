import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { requireContractActorForPage, type PageContractActor } from '@/lib/auth-contract';
import { canAccessBigSmoke } from '@/lib/big-smoke-access';

/** Gate Big Smoke pages: admin, events team, Big Smoke admin, or accounting. */
export async function requireBigSmokePageAccess(): Promise<PageContractActor> {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');
  if (!canAccessBigSmoke(session.user)) redirect('/');

  return requireContractActorForPage();
}
