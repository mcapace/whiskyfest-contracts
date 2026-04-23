import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { updateContractRow } from '@/lib/sheets-tracker';
import type { ContractWithTotals } from '@/types/db';

const schema = z.object({
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id, { adminOnly: true, skipOwnership: true });
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors.reason?.[0] ?? 'Invalid input' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const current = { id: gate.contract.id, status: gate.contract.status };

  // Can cancel from any status EXCEPT executed/cancelled
  if (current.status === 'executed' || current.status === 'cancelled') {
    return NextResponse.json({
      error: `Cannot cancel a contract in status: ${current.status}`
    }, { status: 409 });
  }

  // Update contract
  const { error } = await supabase
    .from('contracts')
    .update({
      status:            'cancelled',
      cancelled_reason:  parsed.data.reason,
      cancelled_at:      new Date().toISOString(),
      cancelled_by:      gate.actor.email,
    })
    .eq('id', params.id);

  if (error) {
    console.error('Cancel failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Extra audit entry with the reason in metadata (status change is already logged by trigger)
  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: gate.actor.email,
    action:      'cancelled',
    from_status: current.status,
    to_status:   'cancelled',
    metadata:    { reason: parsed.data.reason },
  });

  revalidateContractPaths(params.id);

  const { data: cancelledContract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<ContractWithTotals>();
  if (cancelledContract) {
    try {
      await updateContractRow(cancelledContract);
    } catch (err) {
      console.error('Failed to update Sheets tracker', err);
    }
  }

  return NextResponse.json({ ok: true });
}
