import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { todayBubbleContentDateString } from '@/lib/bubble-content-date';
import { getLoginUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Sets `last_dismissed_bubble_date` to today's Eastern date for the signed-in user (login email). */
export async function POST() {
  const gate = await requireAuth();
  if (!gate.ok) return gate.res;

  const email = getLoginUserEmail(gate.session);
  if (!email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = todayBubbleContentDateString();
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('app_users').update({ last_dismissed_bubble_date: today }).eq('email', email);

  if (error) {
    console.error('[dismiss-bubble]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date: today });
}
