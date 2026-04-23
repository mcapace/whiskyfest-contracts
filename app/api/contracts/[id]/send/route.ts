import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { sendEnvelope } from '@/lib/docusign';
import { buildContractMergeMap } from '@/lib/merge-map';
import { requiresDiscountApproval } from '@/lib/contracts';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/** POST — send approved contract via DocuSign (exhibitor routing 1; event countersigner routing 2). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();

  const access = await assertContractAccess(session, params.id, { allowedStatuses: ['approved'] });
  if (!access.ok) return access.response;

  const supabase = getSupabaseAdmin();

  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }
  if (requiresDiscountApproval(contract)) {
    return NextResponse.json(
      { error: 'Discount approval required before contract can be sent to DocuSign.' },
      { status: 403 },
    );
  }

  if (!contract.events_approved_at) {
    return NextResponse.json(
      { error: 'Events team approval is required before this contract can be sent to DocuSign.' },
      { status: 403 },
    );
  }

  if (contract.status !== 'approved') {
    return NextResponse.json(
      {
        error: `Only approved contracts can be sent. Current status: ${contract.status}`,
      },
      { status: 409 },
    );
  }
  if (!contract.signer_1_email || !contract.signer_1_name) {
    return NextResponse.json(
      {
        error: 'Exhibitor signer name and email are required.',
      },
      { status: 400 },
    );
  }

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', contract.event_id)
    .single<Event>();
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const countersignerEmail = event.shanken_signatory_email?.trim();
  const countersignerName = event.shanken_signatory_name?.trim();
  if (!countersignerEmail || !countersignerName) {
    return NextResponse.json(
      { error: 'Event countersigner name and email are required.' },
      { status: 500 },
    );
  }

  const signerEmail = contract.signer_1_email.trim();
  const signerName = contract.signer_1_name.trim();
  const safeCompany = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
  const templateDocId = process.env.GOOGLE_TEMPLATE_DOC_ID!;

  try {
    const mergeMap = buildContractMergeMap(contract, event, 'docusign');
    const fileName = `${contract.exhibitor_company_name.replace(/[^\w\s-]/g, '')} — WhiskyFest ${event.year} Contract (DocuSign)`;

    const pdfBytes = await renderContractPdfFromTemplate(templateDocId, mergeMap, fileName);

    const pdfBase64 = pdfBytes.toString('base64');

    const { envelopeId } = await sendEnvelope({
      pdfBase64,
      documentName: `${safeCompany} — WhiskyFest ${event.year} Contract.pdf`,
      emailSubject: `Please sign: ${event.name} ${event.year} participation contract — ${contract.exhibitor_company_name}`,
      emailBlurb: `Attached is the WhiskyFest ${event.year} participation contract for ${contract.exhibitor_company_name}. Please review and sign.`,
      signer1: { name: signerName, email: signerEmail },
      countersigner: { name: countersignerName, email: countersignerEmail },
    });

    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        docusign_envelope_id: envelopeId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: access.actor.email,
      action: 'pdf_sent',
      metadata: {
        envelope_id: envelopeId,
        envelope_status: 'sent',
        exhibitor_signer: contract.signer_1_email,
        countersigner_email: countersignerEmail,
        countersigner_name: countersignerName,
        docusign_pdf_file: null,
      },
    });

    revalidateContractPaths(contract.id);

    return NextResponse.json({
      ok: true,
      envelope_id: envelopeId,
      exhibitor_signer_email: signerEmail,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send DocuSign]', contract.id, message);

    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign send error: ${message.slice(0, 500)}`,
      })
      .eq('id', contract.id);

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: access.actor.email,
      action: 'pdf_send_failed',
      metadata: { error: message.slice(0, 500) },
    });

    revalidateContractPaths(contract.id);

    return NextResponse.json(
      {
        error: message || 'DocuSign send failed',
      },
      { status: 500 },
    );
  }
}
