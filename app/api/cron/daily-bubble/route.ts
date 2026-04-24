import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendBubbleGeneratedEmail, sendBubbleGenerationFailedEmail } from '@/lib/bubble-email';
import { generateDailyBubble } from '@/lib/bubble-generator';
import { todayBubbleContentDateString } from '@/lib/bubble-content-date';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env['CRON_SECRET']?.trim();
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const today = todayBubbleContentDateString();
  const supabase = getSupabaseAdmin();

  try {
    const { data: existing, error: exErr } = await supabase
      .from('daily_bubbles')
      .select('id')
      .eq('content_date', today)
      .maybeSingle();

    if (exErr) throw new Error(exErr.message);
    if (existing?.id) {
      return NextResponse.json({ status: 'already_generated', date: today });
    }

    let generated;
    try {
      generated = await generateDailyBubble();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[cron/daily-bubble] generation failed:', e);
      await sendBubbleGenerationFailedEmail(msg);
      return NextResponse.json({ status: 'error', error: msg }, { status: 500 });
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
        return NextResponse.json({ status: 'already_generated', date: today });
      }
      throw new Error(insErr.message);
    }

    const bubble = row as import('@/types/db').DailyBubble;
    try {
      await sendBubbleGeneratedEmail(bubble, removeToken);
    } catch (mailErr) {
      console.error('[cron/daily-bubble] notification email failed:', mailErr);
    }

    return NextResponse.json({ status: 'generated', bubble: { ...bubble, remove_token: undefined } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cron/daily-bubble]', err);
    await sendBubbleGenerationFailedEmail(msg).catch(() => {});
    return NextResponse.json({ status: 'error', error: msg }, { status: 500 });
  }
}
