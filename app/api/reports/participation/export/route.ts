import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import {
  buildParticipationCsv,
  buildParticipationExcel,
  exportParticipationReportToGoogleSheet,
} from '@/lib/participation-report-export';
import { buildParticipationReport } from '@/lib/participation-report';
import { canAccessParticipationReport } from '@/lib/participation-report-shared';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** POST /api/reports/participation/export — { format: 'sheets' | 'csv' | 'xlsx', eventId? } */
export async function POST(req: Request) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;
  if (!canAccessParticipationReport(gate.actor.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { format?: string; eventId?: string };
  const format =
    body.format === 'csv' ? 'csv' : body.format === 'xlsx' || body.format === 'excel' ? 'xlsx' : 'sheets';
  const eventId = body.eventId ?? null;

  try {
    if (format === 'csv') {
      const report = await buildParticipationReport({ eventId });
      if (!report) return NextResponse.json({ error: 'No WhiskyFest event found' }, { status: 404 });
      const csv = buildParticipationCsv(report);
      const filename = `wf-ny-${report.event.year}-participation.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === 'xlsx') {
      const report = await buildParticipationReport({ eventId });
      if (!report) return NextResponse.json({ error: 'No WhiskyFest event found' }, { status: 404 });
      const buffer = await buildParticipationExcel(report);
      const filename = `wf-ny-${report.event.year}-participation.xlsx`;
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const result = await exportParticipationReportToGoogleSheet({
      eventId,
      shareWithEmail: gate.actor.email,
    });
    return NextResponse.json({
      ok: true,
      spreadsheetId: result.spreadsheetId,
      webViewLink: result.webViewLink,
      title: result.title,
    });
  } catch (err) {
    console.error('[participation-export]', err);
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
