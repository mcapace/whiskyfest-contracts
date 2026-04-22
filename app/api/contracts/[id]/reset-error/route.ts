import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';

/** Admin-only: move an error-state contract back to draft for correction. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id, { adminOnly: true });
  if (!gate.ok) return gate.response;

  if (gate.contract.status !== 'error') {
    return NextResponse.json({ error: 'Only contracts in error status can be reset.' }, { status: 409 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('contracts')
    .update({
      status: 'draft',
      notes: null,
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: gate.actor.email,
    action: 'error_reset_to_draft',
    from_status: 'error',
    to_status: 'draft',
    metadata: {},
  });

  revalidateContractPaths(params.id);

  return NextResponse.json({ ok: true });
}
