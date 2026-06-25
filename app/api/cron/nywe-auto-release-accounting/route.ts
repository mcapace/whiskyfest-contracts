import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { autoReleaseNyweAfterCountersign } from '@/lib/nywe-auto-release-accounting';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import type { ContractWithTotals } from '@/types/db';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Retry NYWE auto-release for countersigned licenses stuck in `signed` (missed webhook / SendGrid blip). */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await getActiveWineSpectatorEvent();
  if (!event) {
    return NextResponse.json({ error: 'No active Wine Spectator event.' }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  const { data: stuck } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', event.id)
    .eq('status', 'signed')
    .is('executed_at', null)
    .limit(50);

  let released = 0;
  let failed = 0;
  const errors: { id: string; company: string; error: string }[] = [];

  for (const row of (stuck ?? []) as ContractWithTotals[]) {
    const result = await autoReleaseNyweAfterCountersign({
      supabase,
      contractId: row.id,
      event,
      countersignerEmail: row.countersigned_by_email,
    });
    if (result.released) {
      released += 1;
    } else if (result.error) {
      failed += 1;
      errors.push({ id: row.id, company: row.exhibitor_company_name, error: result.error });
    }
  }

  return NextResponse.json({ ok: true, scanned: stuck?.length ?? 0, released, failed, errors });
}
