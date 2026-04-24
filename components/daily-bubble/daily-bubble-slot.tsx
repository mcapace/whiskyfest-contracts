import { auth } from '@/lib/auth';
import { todayBubbleContentDateString } from '@/lib/bubble-content-date';
import { getLoginUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DailyBubblePublic } from '@/types/db';
import { DailyBubbleBanner } from './daily-bubble-banner';

function toPublicBubble(row: Record<string, unknown>): DailyBubblePublic {
  const {
    id,
    content_date,
    content_type,
    content,
    attribution,
    generated_at,
    generated_by,
    removed_at,
    removed_by,
    removed_reason,
  } = row;
  return {
    id: String(id),
    content_date: String(content_date),
    content_type: content_type as DailyBubblePublic['content_type'],
    content: String(content),
    attribution: attribution != null ? String(attribution) : null,
    generated_at: String(generated_at),
    generated_by: String(generated_by ?? 'ai'),
    removed_at: removed_at != null ? String(removed_at) : null,
    removed_by: removed_by != null ? String(removed_by) : null,
    removed_reason: removed_reason != null ? String(removed_reason) : null,
  };
}

/** Server: today’s active bubble + per-user dismiss (login email). */
export async function DailyBubbleSlot() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const loginEmail = getLoginUserEmail(session);
  if (!loginEmail) return null;

  const today = todayBubbleContentDateString();
  const supabase = getSupabaseAdmin();

  const [{ data: bubbleRow }, { data: userRow }] = await Promise.all([
    supabase.from('daily_bubbles').select('*').eq('content_date', today).is('removed_at', null).maybeSingle(),
    supabase.from('app_users').select('last_dismissed_bubble_date').eq('email', loginEmail).maybeSingle(),
  ]);

  if (!bubbleRow) return null;

  const dismissed = (userRow as { last_dismissed_bubble_date?: string | null } | null)?.last_dismissed_bubble_date === today;
  if (dismissed) return null;

  const bubble = toPublicBubble(bubbleRow as Record<string, unknown>);
  const isAdmin = session.user.role === 'admin';
  const readOnlyImpersonation = Boolean(session.is_read_only_impersonation);

  return <DailyBubbleBanner bubble={bubble} isAdmin={isAdmin} readOnlyImpersonation={readOnlyImpersonation} />;
}
