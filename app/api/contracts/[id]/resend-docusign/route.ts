import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resendEnvelopeNotifications } from '@/lib/docusign';

export const runtime = 'nodejs';

/** Resend DocuSign notification emails to outstanding signers (same addresses as the live envelope). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, docusign_envelope_id')
    .eq('id', params.id)
    .single();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json(
      { error: 'Resend is only available while the envelope is sent or partially signed.' },
      { status: 409 },
    );
  }

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return NextResponse.json({ error: 'No DocuSign envelope on this contract.' }, { status: 409 });
  }

  try {
    await resendEnvelopeNotifications(envelopeId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: session.user.email,
    action: 'docusign_resend_notification',
    metadata: { envelope_id: envelopeId },
  });

  return NextResponse.json({ ok: true });
}
