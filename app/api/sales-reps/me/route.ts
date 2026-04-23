import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';
import type { SalesRep } from '@/types/db';

export const dynamic = 'force-dynamic';

/** Sales rep profile for the logged-in user's email (or null). Does not require a sales rep row for access. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = getEffectiveUserEmail(session)!;
  const supabase = getSupabaseAdmin();

  const { data: appUser } = await supabase.from('app_users').select('is_active').eq('email', email).single();
  if (!appUser?.is_active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: sr } = await supabase.from('sales_reps').select('*').eq('email', email).eq('is_active', true).maybeSingle();

  return NextResponse.json({ sales_rep: sr as SalesRep | null });
}
