import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { voidEnvelope } from '@/lib/docusign';

export const runtime = 'nodejs';

const schema = z.object({
  voidedReason: z.string().max(1000).optional(),
});

/**
 * Void the DocuSign envelope and return the contract to **approved** so the team can
 * fix exhibitor email and use **Send via DocuSign** again.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
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
      { error: 'Recall is only available while the envelope is sent or partially signed.' },
      { status: 409 },
    );
  }

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return NextResponse.json({ error: 'No DocuSign envelope on this contract.' }, { status: 409 });
  }

  const voidedReason =
    parsed.data.voidedReason?.trim() ||
    'Recalled from WhiskyFest to update recipient details and resend.';

  try {
    await voidEnvelope(envelopeId, voidedReason);
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

  if (error) {
    console.error('Recall DB update failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: session.user.email,
    action: 'docusign_recalled',
    from_status: contract.status,
    to_status: 'approved',
    metadata: { voided_envelope_id: envelopeId, voided_reason: voidedReason },
  });

  return NextResponse.json({ ok: true });
}
