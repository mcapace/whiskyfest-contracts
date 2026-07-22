import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { upsertConfirmedOverride } from '@/lib/participation-report';
import { canAccessParticipationReport } from '@/lib/participation-report-shared';

export const runtime = 'nodejs';

const schema = z.object({
  eventId: z.string().uuid(),
  contractId: z.string().uuid(),
  boothCountOverride: z.number().int().min(0).max(100).nullable().optional(),
  /** Extra dollars billed outside the contract (e.g. 30000 → $30,000). */
  additionalSpendDollars: z.number().min(0).max(10_000_000).optional(),
  /** When set, replaces contract + additional entirely (dollars). Pass null to clear. */
  totalSpendOverrideDollars: z.number().min(0).max(10_000_000).nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  clearOverrides: z.boolean().optional(),
});

async function requireAccess() {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate;
  if (!canAccessParticipationReport(gate.actor.email)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return gate;
}

/** PATCH — Kate adjusts Confirmed booths / separately billed amounts. */
export async function PATCH(req: Request) {
  const gate = await requireAccess();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    eventId,
    contractId,
    boothCountOverride,
    additionalSpendDollars,
    totalSpendOverrideDollars,
    notes,
    clearOverrides,
  } = parsed.data;

  const result = await upsertConfirmedOverride({
    eventId,
    contractId,
    boothCountOverride,
    additionalSpendCents:
      additionalSpendDollars === undefined ? undefined : Math.round(additionalSpendDollars * 100),
    totalSpendOverrideCents:
      totalSpendOverrideDollars === undefined
        ? undefined
        : totalSpendOverrideDollars === null
          ? null
          : Math.round(totalSpendOverrideDollars * 100),
    notes,
    clearOverrides,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, override: result.row });
}
