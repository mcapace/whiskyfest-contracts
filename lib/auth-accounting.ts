import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';

export interface AccountingPageActor {
  email: string;
  isAdmin: boolean;
  isAccounting: boolean;
}

/** Active users who may open the AR dashboard: accounting flag or admin. */
export async function requireAccountingPageAccess(): Promise<AccountingPageActor> {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');

  const email = getEffectiveUserEmail(session);
  if (!email) redirect('/auth/login');

  const isAdmin = session.user.role === 'admin';
  const isAccounting = Boolean(session.user.is_accounting);

  if (!isAccounting && !isAdmin) {
    redirect('/');
  }

  const supabase = getSupabaseAdmin();
  const { data: appUser } = await supabase
    .from('app_users')
    .select('is_active')
    .eq('email', email)
    .maybeSingle();

  if (!appUser?.is_active) redirect('/auth/login');

  return { email, isAdmin, isAccounting };
}
