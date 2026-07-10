import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { buildContractRevisionPlan, loadContractAndEventForRevision } from '@/lib/contract-revision-plan-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  change_request: z.string().trim().min(10).max(50000),
});

/** Parse client change requests into a structured template edit plan (preview before send). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { contract, event } = await loadContractAndEventForRevision(params.id);
    const result = await buildContractRevisionPlan({
      contract,
      event,
      changeRequest: parsed.data.change_request,
      revisionUploadPath: contract.revision_upload_path,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Revision analysis failed';
    console.error('[revision-plan]', params.id, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
