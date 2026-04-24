import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getEffectiveUserEmail } from '@/lib/effective-user';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = getEffectiveUserEmail(session);
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { tour_completed?: boolean; tour_last_role?: string };
  if (!body.tour_completed) return NextResponse.json({ ok: true });

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('app_users')
    .update({
      tour_completed_at: new Date().toISOString(),
      tour_last_role: body.tour_last_role ?? session.user.role ?? null,
    })
    .eq('email', email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
