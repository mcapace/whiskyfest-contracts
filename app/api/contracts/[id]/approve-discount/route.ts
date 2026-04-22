import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isDiscountedRate } from '@/lib/contracts';
import { notifySalesRepDiscountApproved } from '@/lib/notifications';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Contract } from '@/types/db';

const schema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Reason must be 1000 characters or fewer.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, booth_rate_cents, discount_approved_at')
    .eq('id', params.id)
    .single<Pick<Contract, 'id' | 'booth_rate_cents' | 'discount_approved_at'>>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (contract.discount_approved_at) {
    return NextResponse.json({ error: 'Already approved' }, { status: 400 });
  }
  if (!isDiscountedRate(contract.booth_rate_cents)) {
    return NextResponse.json({ error: 'Contract does not require discount approval' }, { status: 400 });
  }

  const reason = parsed.data.reason?.trim() || null;
  const now = new Date().toISOString();
  const approverEmail = gate.session.user.email ?? null;

  const { data: updated, error: updateError } = await supabase
    .from('contracts')
    .update({
      discount_approved_at: now,
      discount_approved_by: approverEmail,
      discount_approval_reason: reason,
    })
    .eq('id', params.id)
    .select('*')
    .single<Contract>();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 });
  }

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: approverEmail,
    action: 'discount_approved',
    metadata: {
      approver_email: approverEmail,
      booth_rate_cents: updated.booth_rate_cents,
      reason,
    },
  });

  revalidateContractPaths(params.id);

  void notifySalesRepDiscountApproved(
    updated,
    {
      email: gate.session.user!.email!,
      name: gate.session.user?.name ?? null,
    },
    reason,
  ).catch((err) => console.error('[notifySalesRepDiscountApproved]', err));

  return NextResponse.json({ ok: true, contract: updated });
}
