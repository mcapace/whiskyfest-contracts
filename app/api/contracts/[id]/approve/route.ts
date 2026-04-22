import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requiresDiscountApproval } from '@/lib/contracts';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id, {
    allowedStatuses: ['ready_for_review'],
  });
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseAdmin();
  const contract = gate.contract;
  if (requiresDiscountApproval(contract)) {
    return NextResponse.json(
      { error: 'Discount approval required before contract can be approved for sending.' },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('contracts')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'ready_for_review'); // only approve from review

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateContractPaths(params.id);

  return NextResponse.json({ ok: true });
}
