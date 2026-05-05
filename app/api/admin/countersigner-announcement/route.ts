import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { notifyCountersignerRoleAnnouncement } from '@/lib/notifications';

/** One-shot: email Liz + Nicole after countersigner migration (admin only). */
export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    await notifyCountersignerRoleAnnouncement();
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
