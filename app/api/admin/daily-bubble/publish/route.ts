import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { publishDailyBubbleIfNeeded } from '@/lib/daily-bubble-publish';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Admin-only: generate and save today’s bubble (same as cron). Use if the banner is empty after deploy/migration. */
export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const outcome = await publishDailyBubbleIfNeeded();

  if (outcome.status === 'error') {
    return NextResponse.json({ status: 'error', error: outcome.error, date: outcome.date }, { status: 500 });
  }

  if (outcome.status === 'already_generated') {
    return NextResponse.json({ status: 'already_generated', date: outcome.date });
  }

  return NextResponse.json({ status: 'generated', date: outcome.date, bubble: outcome.bubble });
}
