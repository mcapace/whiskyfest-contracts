import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildContractMergeMap } from '@/lib/merge-map';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { isDocuSignParallelSigners, sendEnvelope } from '@/lib/docusign';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/**
 * INSTRUMENTED — each step logs with `[send <traceId>]` so Vercel runtime logs show the full flow.
 */

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const traceId = Math.random().toString(36).substring(2, 8);
  const log = (msg: string, extra?: unknown) => {
    const line = `[send ${traceId}] ${msg}`;
    if (extra !== undefined) console.log(line, extra);
    else console.log(line);
  };

  log('START', { contractId: params.id });

  const session = await auth();
  if (!session?.user?.email) {
    log('FAIL unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  log('auth ok', { user: session.user.email });

  const supabase = getSupabaseAdmin();

  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();

  if (!contract) {
    log('FAIL contract not found');
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }
  log('contract loaded', {
    status: contract.status,
    exhibitor: contract.exhibitor_company_name,
    signer_email: contract.signer_1_email,
    signer_name: contract.signer_1_name,
  });

  if (contract.status !== 'approved') {
    log('FAIL bad status', { status: contract.status });
    return NextResponse.json({ error: 'Contract must be approved before sending' }, { status: 400 });
  }

  const signerEmail = contract.signer_1_email?.trim();
  const signerName = contract.signer_1_name?.trim() || 'Exhibitor signer';
  if (!signerEmail) {
    log('FAIL missing signer email');
    return NextResponse.json({ error: 'Exhibitor signer email is required before sending' }, { status: 400 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', contract.event_id)
    .single<Event>();

  if (!event) {
    log('FAIL event not found');
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  log('event loaded', {
    shanken_signer: event.shanken_signatory_email,
    event_name: event.name,
  });

  const shankenEmail = event.shanken_signatory_email?.trim();
  const shankenName = event.shanken_signatory_name?.trim() || 'M. Shanken Communications';
  if (!shankenEmail) {
    log('FAIL missing Shanken signatory email');
    return NextResponse.json({ error: 'Event is missing Shanken signatory email' }, { status: 400 });
  }

  const templateDocId = process.env.GOOGLE_TEMPLATE_DOC_ID!;
  const mergeMap = buildContractMergeMap(contract, event, 'docusign');
  const safeCompany = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
  const fileLabel = `${safeCompany} — WhiskyFest ${event.year} Contract (DocuSign)`;

  try {
    log('step 1: render PDF from template');
    const pdfBytes = await renderContractPdfFromTemplate(templateDocId, mergeMap, fileLabel);
    const pdfBase64 = pdfBytes.toString('base64');
    log('step 1 ok', { bytes: pdfBytes.length, base64_chars: pdfBase64.length });

    log('step 2: calling DocuSign sendEnvelope');
    log('step 2 env check', {
      has_integration_key: Boolean(process.env.DOCUSIGN_INTEGRATION_KEY),
      has_user_id: Boolean(process.env.DOCUSIGN_USER_ID),
      has_account_id: Boolean(process.env.DOCUSIGN_ACCOUNT_ID),
      has_auth_url: Boolean(process.env.DOCUSIGN_AUTH_URL),
      has_base_url: Boolean(process.env.DOCUSIGN_BASE_URL),
      has_private_key: Boolean(process.env.DOCUSIGN_RSA_PRIVATE_KEY),
      account_id_prefix: process.env.DOCUSIGN_ACCOUNT_ID?.slice(0, 8),
      base_url: process.env.DOCUSIGN_BASE_URL,
      parallel_signers: isDocuSignParallelSigners(),
    });

    const { envelopeId } = await sendEnvelope({
      pdfBase64,
      documentName: `${safeCompany} — WhiskyFest ${event.year} Contract.pdf`,
      emailSubject: `Please sign: ${contract.exhibitor_company_name} — WhiskyFest ${event.year}`,
      emailBlurb: `Please review and sign the participation contract for ${event.name}. Thank you.`,
      signer1: { email: signerEmail, name: signerName },
      signer2: { email: shankenEmail, name: shankenName },
    });

    log('step 2 SUCCESS', { envelope_id: envelopeId });

    log('step 3: updating contract + audit');
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
      metadata: {
        envelope_id: envelopeId,
        exhibitor_signer_email: signerEmail,
        shanken_signatory_email: shankenEmail,
      },
    });

    log('step 3 ok');
    log('COMPLETE', { envelope_id: envelopeId });

    return NextResponse.json({
      ok: true,
      envelope_id: envelopeId,
      parallel_signers: isDocuSignParallelSigners(),
      exhibitor_signer_email: signerEmail,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log('ERROR', {
      message,
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6).join(' | ') : undefined,
    });
    console.error('DocuSign send failed:', err);

    await supabase
      .from('contracts')
      .update({ notes: `DocuSign send error: ${message}` })
      .eq('id', contract.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
