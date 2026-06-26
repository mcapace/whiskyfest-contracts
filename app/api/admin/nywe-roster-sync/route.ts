import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { syncExhibitorRosterMaster } from '@/lib/exhibitor-roster-sync-job';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Admin manual trigger — same job as cron. */
export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const outcome = await syncExhibitorRosterMaster();

  if (outcome.status === 'error') {
    return NextResponse.json({ error: outcome.error }, { status: 500 });
  }

  if (outcome.status === 'skipped') {
    return NextResponse.json({ status: 'skipped', reason: outcome.reason });
  }

  revalidatePath('/wine-spectator/roster');
  revalidatePath('/wine-spectator');

  return NextResponse.json({
    status: 'synced',
    eventId: outcome.eventId,
    eventName: outcome.eventName,
    syncedAt: outcome.syncedAt,
    rowCount: outcome.rowCount,
    writebackCount: outcome.writebackCount,
    contractsUpdated: outcome.contractsUpdated,
  });
}
