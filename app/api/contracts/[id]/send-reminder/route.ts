import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { resendEnvelopeNotifications } from '@/lib/docusign';

export const runtime = 'nodejs';

/** Admin-only: ask DocuSign to resend reminder notifications to outstanding signers. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, docusign_envelope_id')
    .eq('id', params.id)
    .single();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json(
      { error: 'Send Reminder is only available while the DocuSign contract is sent or partially signed.' },
      { status: 409 },
    );
  }

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return NextResponse.json({ error: 'No DocuSign contract is linked to this record.' }, { status: 409 });
  }

  try {
    await resendEnvelopeNotifications(envelopeId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: gate.session.user.email,
    action: 'docusign_send_reminder',
    metadata: { envelope_id: envelopeId },
  });

  return NextResponse.json({ ok: true });
}
