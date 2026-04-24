import { randomBytes } from 'node:crypto';
import { sendBubbleGeneratedEmail, sendBubbleGenerationFailedEmail } from '@/lib/bubble-email';
import { generateDailyBubble } from '@/lib/bubble-generator';
import { todayBubbleContentDateString } from '@/lib/bubble-content-date';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DailyBubble } from '@/types/db';

export type PublishDailyBubbleOutcome =
  | { status: 'generated'; date: string; bubble: Omit<DailyBubble, 'remove_token' | 'remove_token_expires_at'> }
  | { status: 'already_generated'; date: string }
  | { status: 'error'; date: string; error: string };

/**
 * Creates today’s Eastern `content_date` bubble if missing (Claude + DB + notify email).
 * Used by Vercel cron and admin “publish now”.
 */
export async function publishDailyBubbleIfNeeded(): Promise<PublishDailyBubbleOutcome> {
  const today = todayBubbleContentDateString();
  const supabase = getSupabaseAdmin();

  const { data: existing, error: exErr } = await supabase
    .from('daily_bubbles')
    .select('id')
    .eq('content_date', today)
    .maybeSingle();

  if (exErr) {
    const msg = exErr.message;
    console.error('[daily-bubble-publish] list existing:', exErr);
    await sendBubbleGenerationFailedEmail(
      `Could not read daily_bubbles (is migration 028 applied?).\n\n${msg}`,
    ).catch(() => {});
    return { status: 'error', date: today, error: msg };
  }

  if (existing?.id) {
    return { status: 'already_generated', date: today };
  }

  let generated;
  try {
    generated = await generateDailyBubble();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[daily-bubble-publish] Claude failed:', e);
    await sendBubbleGenerationFailedEmail(msg).catch(() => {});
    return { status: 'error', date: today, error: msg };
  }

  const removeToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: row, error: insErr } = await supabase
    .from('daily_bubbles')
    .insert({
      content_date: today,
      content_type: generated.content_type,
      content: generated.content,
      attribution: generated.attribution,
      generated_by: 'ai',
      remove_token: removeToken,
      remove_token_expires_at: expiresAt,
    })
    .select()
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      return { status: 'already_generated', date: today };
    }
    const msg = insErr.message;
    console.error('[daily-bubble-publish] insert failed:', insErr);
    await sendBubbleGenerationFailedEmail(msg).catch(() => {});
    return { status: 'error', date: today, error: msg };
  }

  const bubble = row as DailyBubble;
  try {
    await sendBubbleGeneratedEmail(bubble, removeToken);
  } catch (mailErr) {
    console.error('[daily-bubble-publish] notification email failed:', mailErr);
  }

  const { remove_token: _rt, remove_token_expires_at: _rte, ...publicBubble } = bubble;
  return { status: 'generated', date: today, bubble: publicBubble };
}
