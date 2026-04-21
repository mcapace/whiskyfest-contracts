import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildContractMergeMap } from '@/lib/merge-map';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { sendEnvelope } from '@/lib/docusign';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  if (contract.status !== 'approved') {
    return NextResponse.json({ error: 'Contract must be approved before sending' }, { status: 400 });
  }

  const signerEmail = contract.signer_1_email?.trim();
  const signerName = contract.signer_1_name?.trim() || 'Exhibitor signer';
  if (!signerEmail) {
    return NextResponse.json({ error: 'Exhibitor signer email is required before sending' }, { status: 400 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', contract.event_id)
    .single<Event>();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const shankenEmail = event.shanken_signatory_email?.trim();
  const shankenName = event.shanken_signatory_name?.trim() || 'M. Shanken Communications';
  if (!shankenEmail) {
    return NextResponse.json({ error: 'Event is missing Shanken signatory email' }, { status: 400 });
  }

  const templateDocId = process.env.GOOGLE_TEMPLATE_DOC_ID!;
  const mergeMap = buildContractMergeMap(contract, event, 'docusign');
  const safeCompany = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
  const fileLabel = `${safeCompany} — WhiskyFest ${event.year} Contract (DocuSign)`;

  try {
    const pdfBytes = await renderContractPdfFromTemplate(templateDocId, mergeMap, fileLabel);
    const pdfBase64 = pdfBytes.toString('base64');

    const { envelopeId } = await sendEnvelope({
      pdfBase64,
      documentName: `${safeCompany} — WhiskyFest ${event.year} Contract.pdf`,
      emailSubject: `Please sign: ${contract.exhibitor_company_name} — WhiskyFest ${event.year}`,
      emailBlurb: `Please review and sign the participation contract for ${event.name}. Thank you.`,
      signer1: { email: signerEmail, name: signerName },
      signer2: { email: shankenEmail, name: shankenName },
    });

    const sentAt = new Date().toISOString();

    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        docusign_envelope_id: envelopeId,
        sent_at: sentAt,
      })
      .eq('id', contract.id);

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: session.user.email,
      action: 'docusign_sent',
      metadata: { envelope_id: envelopeId },
    });

    return NextResponse.json({ ok: true, envelope_id: envelopeId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('DocuSign send failed:', err);
    await supabase
      .from('contracts')
      .update({ notes: `DocuSign send error: ${message}` })
      .eq('id', contract.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
