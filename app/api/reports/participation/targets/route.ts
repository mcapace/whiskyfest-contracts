import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { updatePipelineTarget, upsertPipelineTarget } from '@/lib/participation-report';
import { canAccessParticipationReport } from '@/lib/participation-report-shared';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const createSchema = z.object({
  eventId: z.string().uuid(),
  section: z.enum(['pending_renewal', 'new_business']),
  companyName: z.string().min(1).max(200),
  salesRepId: z.string().uuid().nullable().optional(),
  brandsText: z.string().max(4000).nullable().optional(),
  boothCount: z.number().int().min(0).max(100).optional(),
  ratePerBoothCents: z.number().int().min(0).optional(),
  sponsorshipCents: z.number().int().min(0).optional(),
  totalSpendCents: z.number().int().min(0).optional(),
  notes: z.string().max(8000).nullable().optional(),
  linkedContractId: z.string().uuid().nullable().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  company_name: z.string().min(1).max(200).optional(),
  sales_rep_id: z.string().uuid().nullable().optional(),
  brands_text: z.string().max(4000).nullable().optional(),
  booth_count: z.number().int().min(0).max(100).optional(),
  rate_per_booth_cents: z.number().int().min(0).optional(),
  sponsorship_cents: z.number().int().min(0).optional(),
  total_spend_cents: z.number().int().min(0).optional(),
  notes: z.string().max(8000).nullable().optional(),
  linked_contract_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  section: z.enum(['pending_renewal', 'new_business']).optional(),
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

/** POST — create / upsert a pending or new-business row. */
export async function POST(req: Request) {
  const gate = await requireAccess();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await upsertPipelineTarget(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, target: result.row });
}

/** PATCH — update notes / fields / soft-delete. */
export async function PATCH(req: Request) {
  const gate = await requireAccess();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...patch } = parsed.data;
  const result = await updatePipelineTarget(id, patch);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, target: result.row });
}

/** DELETE — soft-deactivate a target (`?id=`). */
export async function DELETE(req: Request) {
  const gate = await requireAccess();
  if (!gate.ok) return gate.response;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const result = await updatePipelineTarget(id, { is_active: false }, getSupabaseAdmin());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
