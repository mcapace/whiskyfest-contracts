import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getAccessibleSalesRepIds } from '@/lib/rep-access';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Row = { id: string; name: string; email: string };

/** Sales reps the caller may assign as deal owner on new/edit draft contracts. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();
  const supabase = getSupabaseAdmin();

  const { data: appUser } = await supabase.from('app_users').select('role, is_active').eq('email', email).single();
  if (!appUser?.is_active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (appUser.role === 'admin') {
    const { data, error } = await supabase
      .from('sales_reps')
      .select('id, name, email')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sales_reps: (data ?? []) as Row[] });
  }

  const ids = await getAccessibleSalesRepIds(email, supabase);
  if (ids.length === 0) {
    return NextResponse.json({ sales_reps: [] as Row[] });
  }

  const { data, error } = await supabase
    .from('sales_reps')
    .select('id, name, email')
    .in('id', ids)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sales_reps: (data ?? []) as Row[] });
}
