import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { buildParticipationReport } from '@/lib/participation-report';
import { canAccessParticipationReport } from '@/lib/participation-report-shared';

export const runtime = 'nodejs';

/** GET /api/reports/participation — full Confirmed / Pending / New Business payload. */
export async function GET(req: Request) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;
  if (!canAccessParticipationReport(gate.actor.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get('eventId');
  const report = await buildParticipationReport({ eventId });
  if (!report) return NextResponse.json({ error: 'No WhiskyFest event found' }, { status: 404 });

  return NextResponse.json(report);
}
