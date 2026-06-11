import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { canAccessWineSpectator } from '@/lib/wine-spectator-access';

export async function requireWineSpectatorActor() {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return { ok: false as const, response: gate.response };
  if (!canAccessWineSpectator(session?.user)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Wine Spectator access requires events team or admin.' }, { status: 403 }),
    };
  }
  return { ok: true as const, actor: gate.actor };
}
