import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { insertContractAudit } from '@/lib/audit-log';
import { eventEmailContextForContract } from '@/lib/product-email';
import { productKeyFromEvent } from '@/lib/product-portal';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const THROTTLE_MS = 30 * 60 * 1000;

/** POST — Record that an authorized user opened the contract detail page. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id);
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - THROTTLE_MS).toISOString();

  const { data: recent } = await supabase
    .from('audit_log')
    .select('id')
    .eq('contract_id', params.id)
    .eq('actor_email', gate.actor.email)
    .eq('action', 'contract_viewed')
    .gte('occurred_at', since)
    .limit(1);

  if (recent?.length) {
    return NextResponse.json({ ok: true, logged: false });
  }

  await insertContractAudit(supabase, {
    contract_id: params.id,
    actor_email: gate.actor.email,
    action: 'contract_viewed',
    metadata: {
      view: 'contract_detail',
      product_key: productKeyFromEvent(await eventEmailContextForContract(gate.contract)),
    },
  });

  return NextResponse.json({ ok: true, logged: true });
}
