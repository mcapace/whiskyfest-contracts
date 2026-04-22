import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { downloadCompletedPdf } from '@/lib/docusign';
import { uploadPdfBufferToFolder } from '@/lib/google';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { notifyPartialSignature } from '@/lib/notifications';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/** DocuSign Connect JSON shapes vary; extract what we need defensively. */
function parseConnectPayload(raw: unknown): {
  eventType: string;
  envelopeId: string | null;
  recipientId: string | null;
  envelopeStatus: string | null;
  routingOrder: string | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { eventType: '', envelopeId: null, recipientId: null, envelopeStatus: null, routingOrder: null };
  }
  const o = raw as Record<string, unknown>;
  const eventType = String(o['event'] ?? o['Event'] ?? '').toLowerCase();

  let envelopeId: string | null = null;
  let recipientId: string | null = null;
  let envelopeStatus: string | null = null;
  let routingOrder: string | null = null;

  const data = o['data'] ?? o['Data'];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    envelopeId =
      (d['envelopeId'] as string | undefined) ||
      ((d['envelopeSummary'] as Record<string, unknown> | undefined)?.['envelopeId'] as string | undefined) ||
      null;
    const rid = d['recipientId'] ?? d['RecipientId'];
    recipientId = rid != null && rid !== '' ? String(rid) : null;
    const summary = d['envelopeSummary'] as Record<string, unknown> | undefined;
    envelopeStatus =
      (summary?.['status'] as string | undefined) ||
      (d['status'] as string | undefined) ||
      null;
    const ro = d['routingOrder'] ?? d['RoutingOrder'];
    if (ro != null && ro !== '') routingOrder = String(ro);
    const rec = d['recipient'] ?? d['Recipient'];
    if (rec && typeof rec === 'object') {
      const r = rec as Record<string, unknown>;
      if (!recipientId) {
        const rid2 = r['recipientId'] ?? r['RecipientId'];
        if (rid2 != null && rid2 !== '') recipientId = String(rid2);
      }
      if (!routingOrder) {
        const ro2 = r['routingOrder'] ?? r['RoutingOrder'];
        if (ro2 != null && ro2 !== '') routingOrder = String(ro2);
      }
    }
  }

  if (!envelopeId) {
    envelopeId = (o['envelopeId'] as string | undefined) ?? (o['EnvelopeId'] as string | undefined) ?? null;
  }

  return { eventType, envelopeId, recipientId, envelopeStatus, routingOrder };
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

  const { eventType, envelopeId, recipientId, envelopeStatus, routingOrder } = parseConnectPayload(parsed);
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
    revalidateContractPaths(contract.id);
    return new NextResponse(null, { status: 200 });
  }

  // --- Exhibitor (routing order 1) finished → Liz gets countersign invite (sequential in DocuSign) ---
  const firstSigner =
    recipientId === '1' || routingOrder === '1';
  if (
    eventType.includes('recipient-completed') &&
    firstSigner &&
    contract.status === 'sent'
  ) {
    await supabase.from('contracts').update({ status: 'partially_signed' }).eq('id', contract.id);
    revalidateContractPaths(contract.id);

    void notifyPartialSignature(contract, event ?? null).catch((err) =>
      console.error('[notifyPartialSignature]', err),
    );

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

  if (contract.status === 'signed' || contract.status === 'executed') {
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
        status: 'signed',
        signed_pdf_drive_id: fileId,
        signed_pdf_url: webViewLink,
        signed_at: now,
      })
      .eq('id', contract.id);

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: null,
      action: 'docusign_completed',
      metadata: { envelope_id: envelopeId, signed_pdf_url: webViewLink, release_required: true },
    });

    revalidateContractPaths(contract.id);
  } catch (err) {
    console.error('DocuSign completion handling failed:', err);
    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign webhook error: ${err instanceof Error ? err.message : String(err)}`,
      })
      .eq('id', contract.id);
    revalidateContractPaths(contract.id);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
