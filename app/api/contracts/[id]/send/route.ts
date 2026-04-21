import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { isDocuSignParallelSigners, sendEnvelope } from '@/lib/docusign';
import { buildContractMergeMap } from '@/lib/merge-map';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/**
 * POST /api/contracts/[id]/send
 *
 * INSTRUMENTED VERSION — logs each step clearly so we can see where
 * things succeed or fail in Vercel runtime logs. Safe to leave in place;
 * the logs just help observability.
 *
 * Note: Step 1 uses `renderContractPdfFromTemplate` + `buildContractMergeMap(..., 'docusign')`
 * (this repo’s PDF path). The wf-debug snapshot used older helper names; behavior matches
 * “regenerate PDF with DocuSign anchors” below.
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
    return NextResponse.json(
      {
        error: `Only approved contracts can be sent. Current status: ${contract.status}`,
      },
      { status: 409 },
    );
  }
  if (!contract.signer_1_email || !contract.signer_1_name) {
    log('FAIL missing signer info');
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

  const signerEmail = contract.signer_1_email.trim();
  const signerName = contract.signer_1_name.trim();
  const safeCompany = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
  const templateDocId = process.env.GOOGLE_TEMPLATE_DOC_ID!;

  try {
    // Step 1 — Regenerate PDF with DocuSign anchor strings
    log('step 1: regenerating PDF with docusign anchors');
    const mergeMap = buildContractMergeMap(contract, event, 'docusign');
    const fileName = `${contract.exhibitor_company_name.replace(/[^\w\s-]/g, '')} — WhiskyFest ${event.year} Contract (DocuSign)`;

    const pdfBytes = await renderContractPdfFromTemplate(templateDocId, mergeMap, fileName);
    log('step 1 ok', {
      bytes_size: pdfBytes.length,
    });

    const pdfBase64 = pdfBytes.toString('base64');

    // Step 2 — Send envelope via DocuSign
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
    });

    const { envelopeId } = await sendEnvelope({
      pdfBase64,
      documentName: `${safeCompany} — WhiskyFest ${event.year} Contract.pdf`,
      emailSubject: `Please sign: ${event.name} ${event.year} participation contract — ${contract.exhibitor_company_name}`,
      emailBlurb: `Attached is the WhiskyFest ${event.year} participation contract for ${contract.exhibitor_company_name}. Please review and sign.`,
      signer1: { name: signerName, email: signerEmail },
      signer2: { name: shankenName, email: shankenEmail },
    });

    log('step 2 SUCCESS', {
      envelope_id: envelopeId,
      envelope_status: 'sent',
    });

    // Step 3 — Update the contract
    log('step 3: updating contract record');
    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        docusign_envelope_id: envelopeId,
        sent_at: new Date().toISOString(),
      })
      .eq('id', contract.id);
    log('step 3 ok');

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: session.user.email,
      action: 'pdf_sent',
      metadata: {
        envelope_id: envelopeId,
        envelope_status: 'sent',
        exhibitor_signer: contract.signer_1_email,
        shanken_signer: event.shanken_signatory_email,
        docusign_pdf_file: null,
      },
    });

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
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
    });

    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign send error: ${message.slice(0, 500)}`,
      })
      .eq('id', contract.id);

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: session.user.email,
      action: 'pdf_send_failed',
      metadata: { error: message.slice(0, 500) },
    });

    return NextResponse.json({
      error: message || 'DocuSign send failed',
    }, { status: 500 });
  }
}
