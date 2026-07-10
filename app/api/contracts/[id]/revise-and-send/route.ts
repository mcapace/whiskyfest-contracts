import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { reviseAndSendBodySchema, reviseAndSendContract } from '@/lib/contract-revision';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Recall in-flight contract, apply client revisions, regenerate customized PDF (or use upload), send DocuSign.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = reviseAndSendBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await reviseAndSendContract({
      contractId: params.id,
      actorEmail: gate.actor.email,
      body: parsed.data,
    });
    revalidateContractPaths(params.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Revise and send failed';
    console.error('[revise-and-send]', params.id, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
