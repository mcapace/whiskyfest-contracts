import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';

export async function requireWineSpectatorActor() {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return { ok: false as const, response: gate.response };
  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Wine Spectator roster requires events team access.' }, { status: 403 }),
    };
  }
  return { ok: true as const, actor: gate.actor };
}
