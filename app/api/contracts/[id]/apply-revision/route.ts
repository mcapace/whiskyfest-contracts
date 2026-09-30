import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { reviseAndSendBodySchema } from '@/lib/contract-revision';
import { applyContractRevision } from '@/lib/contract-revision-apply';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Apply client amendments to an unsent contract (draft / review / approved): persist inline edits,
 * update the record, regenerate the clean draft PDF. No DocuSign activity.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = reviseAndSendBodySchema.safeParse({
    ...(raw ?? {}),
    reason:
      typeof raw?.reason === 'string' && raw.reason.trim().length >= 10 ? raw.reason : 'Client amendments applied',
    use_uploaded_pdf: false,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await applyContractRevision({
      contractId: params.id,
      actorEmail: gate.actor.email,
      body: parsed.data,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Applying amendments failed';
    console.error('[apply-revision]', params.id, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
