import { auth } from '@/lib/auth';
import { todayBubbleContentDateString } from '@/lib/bubble-content-date';
import { staticFallbackBubble } from '@/lib/daily-bubble-fallback';
import { getLoginUserEmail } from '@/lib/effective-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { DailyBubblePublic } from '@/types/db';
import { DailyBubbleBanner } from './daily-bubble-banner';

/** Normalize DB `date` / timestamptz to `YYYY-MM-DD` for Eastern dismiss comparison. */
function dateOnlyKey(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1]! : null;
}

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

  const [{ data: rpcData, error: rpcErr }, { data: userRow, error: userErr }] = await Promise.all([
    supabase.rpc('get_active_daily_bubble_eastern_today'),
    supabase.from('app_users').select('last_dismissed_bubble_date').eq('email', loginEmail).maybeSingle(),
  ]);

  let bubbleRow: Record<string, unknown> | null = null;
  let bubbleSourceErr: string | null = null;

  if (!rpcErr && rpcData != null) {
    const rows = rpcData as Record<string, unknown>[] | Record<string, unknown> | null;
    if (Array.isArray(rows)) {
      bubbleRow = rows[0] ?? null;
    } else if (rows && typeof rows === 'object' && 'id' in rows) {
      bubbleRow = rows as Record<string, unknown>;
    }
  }
  if (bubbleRow == null) {
    const legacy = await supabase
      .from('daily_bubbles')
      .select('*')
      .eq('content_date', today)
      .is('removed_at', null)
      .maybeSingle();
    if (legacy.error) {
      bubbleSourceErr = legacy.error.message;
      console.error('[daily-bubble-slot] daily_bubbles query:', legacy.error.message);
    } else {
      bubbleRow = legacy.data as Record<string, unknown> | null;
    }
    if (rpcErr && !legacy.error) {
      console.warn(
        '[daily-bubble-slot] RPC get_active_daily_bubble_eastern_today unavailable; using legacy query:',
        rpcErr.message,
      );
    }
  }

  if (userErr) {
    console.error('[daily-bubble-slot] app_users query:', userErr.message);
  }

  const dismissedRaw = (userRow as { last_dismissed_bubble_date?: string | null } | null)?.last_dismissed_bubble_date;
  const dismissed = dateOnlyKey(dismissedRaw) === today;
  if (dismissed) return null;

  const fromDb = bubbleRow != null;
  const bubble: DailyBubblePublic = fromDb && bubbleRow
    ? toPublicBubble(bubbleRow)
    : staticFallbackBubble(today);

  if (!fromDb) {
    if (bubbleSourceErr) {
      console.warn('[daily-bubble-slot] showing static fallback after DB error');
    } else {
      console.info('[daily-bubble-slot] no row for Eastern today; showing static fallback (cron or admin publish will replace)');
    }
  }

  const isAdmin = session.user.role === 'admin';
  const readOnlyImpersonation = Boolean(session.is_read_only_impersonation);

  return (
    <DailyBubbleBanner
      bubble={bubble}
      isAdmin={isAdmin}
      readOnlyImpersonation={readOnlyImpersonation}
      isStaticFallback={!fromDb}
    />
  );
}
