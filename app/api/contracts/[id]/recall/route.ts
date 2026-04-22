import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { voidEnvelope } from '@/lib/docusign';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';

export const runtime = 'nodejs';

const schema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

/** Admin-only: void the active DocuSign contract and return this record to approved. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Recall reason is required and must be at least 10 characters.' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, docusign_envelope_id')
    .eq('id', params.id)
    .single();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json(
      { error: 'Recall is only available while the DocuSign contract is sent or partially signed.' },
      { status: 409 },
    );
  }

  const oldEnvelopeId = contract.docusign_envelope_id?.trim();
  if (!oldEnvelopeId) {
    return NextResponse.json({ error: 'No DocuSign contract is linked to this record.' }, { status: 409 });
  }

  try {
    await voidEnvelope(oldEnvelopeId, parsed.data.reason);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { error } = await supabase
    .from('contracts')
    .update({
      status: 'approved',
      docusign_envelope_id: null,
      sent_at: null,
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: gate.session.user.email,
    action: 'docusign_recalled',
    from_status: contract.status,
    to_status: 'approved',
    metadata: { old_envelope_id: oldEnvelopeId, reason: parsed.data.reason },
  });

  revalidateContractPaths(params.id);

  return NextResponse.json({ ok: true });
}
