import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { downloadCompletedPdf } from '@/lib/docusign';
import { uploadPdfBufferToFolder } from '@/lib/google';
import { sendAccountingEmail } from '@/lib/email';
import { formatLongDate } from '@/lib/utils';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

function appBaseUrl(): string {
  const explicit = process.env['NEXTAUTH_URL']?.replace(/\/$/, '');
  if (explicit) return explicit;
  if (process.env['VERCEL_URL']) return `https://${process.env['VERCEL_URL']}`;
  return 'http://localhost:3000';
}

/** DocuSign Connect JSON shapes vary; extract what we need defensively. */
function parseConnectPayload(raw: unknown): {
  eventType: string;
  envelopeId: string | null;
  recipientId: string | null;
  envelopeStatus: string | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { eventType: '', envelopeId: null, recipientId: null, envelopeStatus: null };
  }
  const o = raw as Record<string, unknown>;
  const eventType = String(o['event'] ?? o['Event'] ?? '').toLowerCase();

  let envelopeId: string | null = null;
  let recipientId: string | null = null;
  let envelopeStatus: string | null = null;

  const data = o['data'] ?? o['Data'];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    envelopeId =
      (d['envelopeId'] as string | undefined) ||
      ((d['envelopeSummary'] as Record<string, unknown> | undefined)?.['envelopeId'] as string | undefined) ||
      null;
    recipientId = (d['recipientId'] as string | undefined) ?? null;
    const summary = d['envelopeSummary'] as Record<string, unknown> | undefined;
    envelopeStatus =
      (summary?.['status'] as string | undefined) ||
      (d['status'] as string | undefined) ||
      null;
  }

  if (!envelopeId) {
    envelopeId = (o['envelopeId'] as string | undefined) ?? (o['EnvelopeId'] as string | undefined) ?? null;
  }

  return { eventType, envelopeId, recipientId, envelopeStatus };
}

function verifyHmac(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
  try {
    const a = Buffer.from(signatureHeader, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env['DOCUSIGN_CONNECT_HMAC_SECRET']?.trim();
  if (secret) {
    const sig =
      req.headers.get('x-docusign-signature-1') ??
      req.headers.get('X-DocuSign-Signature-1');
    if (!verifyHmac(rawBody, sig, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    // Connect can be configured for XML; acknowledge without processing.
    return new NextResponse(null, { status: 200 });
  }

  const { eventType, envelopeId, recipientId, envelopeStatus } = parseConnectPayload(parsed);
  if (!envelopeId) {
    return new NextResponse(null, { status: 200 });
  }

  const supabase = getSupabaseAdmin();

  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('docusign_envelope_id', envelopeId)
    .maybeSingle<ContractWithTotals>();

  if (!contract) {
    console.warn('DocuSign webhook: no contract for envelope', envelopeId);
    return new NextResponse(null, { status: 200 });
  }

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', contract.event_id)
    .single<Event>();

  // --- Void / decline ---
  if (
    eventType.includes('void') ||
    eventType.includes('decline') ||
    envelopeStatus === 'voided' ||
    envelopeStatus === 'declined'
  ) {
    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign: envelope ${envelopeStatus ?? eventType}`,
      })
      .eq('id', contract.id);
    return new NextResponse(null, { status: 200 });
  }

  // --- First signer finished ---
  if (
    eventType.includes('recipient-completed') &&
    recipientId === '1' &&
    contract.status === 'sent'
  ) {
    await supabase.from('contracts').update({ status: 'partially_signed' }).eq('id', contract.id);
    return new NextResponse(null, { status: 200 });
  }

  // --- Fully completed ---
  const completed =
    eventType.includes('envelope-completed') ||
    eventType.includes('envelope_completed') ||
    envelopeStatus === 'completed';

  if (!completed) {
    return new NextResponse(null, { status: 200 });
  }

  if (contract.status === 'executed' && contract.accounting_notified_at) {
    return new NextResponse(null, { status: 200 });
  }

  try {
    const pdfBytes = await downloadCompletedPdf(envelopeId);
    const signedFolderId = process.env.GOOGLE_SIGNED_FOLDER_ID!;
    const safeName = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
    const year = event?.year ?? new Date().getFullYear();
    const fileBase = `${safeName} — WhiskyFest ${year} Contract (SIGNED)`;

    const { fileId, webViewLink } = await uploadPdfBufferToFolder(pdfBytes, fileBase, signedFolderId);

    const now = new Date().toISOString();

    await supabase
      .from('contracts')
      .update({
        status: 'executed',
        signed_pdf_drive_id: fileId,
        signed_pdf_url: webViewLink,
        signed_at: now,
        executed_at: now,
      })
      .eq('id', contract.id);

    if (event && process.env['SENDGRID_API_KEY']) {
      try {
        await sendAccountingEmail({
          exhibitorCompanyName: contract.exhibitor_company_name,
          exhibitorLegalName: contract.exhibitor_legal_name,
          eventName: event.name,
          eventDate: formatLongDate(event.event_date),
          eventYear: event.year,
          boothCount: contract.booth_count,
          boothRateCents: contract.booth_rate_cents,
          additionalBrandCount: contract.additional_brand_count,
          grandTotalCents: contract.grand_total_cents,
          signerName: contract.signer_1_name,
          signerTitle: contract.signer_1_title,
          signerEmail: contract.signer_1_email,
          exhibitorTelephone: contract.exhibitor_telephone,
          exhibitorAddress: contract.exhibitor_address,
          signedPdfUrl: webViewLink,
          signedPdfBytes: pdfBytes,
          contractId: contract.id,
          dashboardUrl: `${appBaseUrl()}/contracts/${contract.id}`,
        });

        await supabase.from('contracts').update({ accounting_notified_at: now }).eq('id', contract.id);
      } catch (emailErr) {
        console.error('Accounting email failed:', emailErr);
      }
    }

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: null,
      action: 'docusign_completed',
      metadata: { envelope_id: envelopeId, signed_pdf_url: webViewLink },
    });
  } catch (err) {
    console.error('DocuSign completion handling failed:', err);
    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign webhook error: ${err instanceof Error ? err.message : String(err)}`,
      })
      .eq('id', contract.id);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
