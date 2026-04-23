import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import { UsersAdmin } from '@/components/users/users-admin';
import type { AppUser } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/auth/login');
  if ((session.user as { role?: string }).role !== 'admin') redirect('/');

  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase.from('app_users').select('*').order('email', { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <h1 className="font-serif text-4xl font-semibold tracking-tight">Users</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Promote teammates to admin, assign viewer access, or deactivate accounts. New @mshanken.com logins are added
          automatically as sales.
        </p>
      </div>

      <UsersAdmin initialUsers={(users ?? []) as AppUser[]} currentEmail={getEffectiveUserEmail(session)!} />
    </div>
  );
}
