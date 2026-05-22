import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchEnvelopeSigners, fetchEnvelopeStatus } from '@/lib/docusign';
import {
  applyEnvelopeFullySigned,
  applyExhibitorPartialSignature,
  isDocuSignEnvelopeFullySigned,
} from '@/lib/docusign-envelope-sync';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { updateContractRow } from '@/lib/sheets-tracker';
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

function isFirstSignerEvent(
  recipientId: string | null,
  routingOrder: string | null,
  signers: Awaited<ReturnType<typeof fetchEnvelopeSigners>>,
): boolean {
  if (routingOrder === '1' || recipientId === '1') return true;
  const r1 = signers.find((s) => s.routingOrder === '1') ?? signers[0];
  if (!r1?.recipientId || !recipientId) return routingOrder !== '2' && recipientId !== '2';
  return r1.recipientId === recipientId;
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

    const { data: afterVoid } = await supabase
      .from('contracts_with_totals')
      .select('*')
      .eq('id', contract.id)
      .maybeSingle<ContractWithTotals>();
    if (afterVoid) {
      try {
        await updateContractRow(afterVoid, {
          trackerStatus: envelopeStatus === 'declined' ? 'declined' : 'voided',
        });
      } catch (err) {
        console.error('Failed to update Sheets tracker', err);
      }
    }

    return new NextResponse(null, { status: 200 });
  }

  const completedEvent =
    eventType.includes('envelope-completed') ||
    eventType.includes('envelope_completed') ||
    envelopeStatus === 'completed';
  const recipientCompletedEvent =
    eventType.includes('recipient-completed') || eventType.includes('recipient_completed');

  // --- Fully signed (envelope-completed OR countersigner recipient-completed when both parties are done) ---
  if (
    contract.status !== 'signed' &&
    contract.status !== 'executed' &&
    (completedEvent || recipientCompletedEvent)
  ) {
    try {
      const signers = await fetchEnvelopeSigners(envelopeId);
      let envStatus = envelopeStatus?.trim() ?? '';
      if (!envStatus) {
        const st = await fetchEnvelopeStatus(envelopeId);
        envStatus = st.status;
      }
      if (isDocuSignEnvelopeFullySigned(envStatus, signers)) {
        await applyEnvelopeFullySigned(supabase, contract, event ?? null, envelopeId);
        return new NextResponse(null, { status: 200 });
      }
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
  }

  // --- Exhibitor (routing order 1) completed → partially_signed ---
  if (recipientCompletedEvent && contract.status === 'sent') {
    let firstSigner = routingOrder === '1' || recipientId === '1';
    if (!firstSigner) {
      try {
        const signers = await fetchEnvelopeSigners(envelopeId);
        firstSigner = isFirstSignerEvent(recipientId, routingOrder, signers);
      } catch (e) {
        console.error('[docusign-webhook] fetchEnvelopeSigners for routing', e);
        firstSigner = routingOrder !== '2' && recipientId !== '2';
      }
    }

    if (firstSigner) {
      try {
        await applyExhibitorPartialSignature(supabase, contract, event ?? null, envelopeId);
      } catch (e) {
        console.error('[docusign-webhook] partially_signed apply failed', e);
      }
      return new NextResponse(null, { status: 200 });
    }
  }

  return new NextResponse(null, { status: 200 });
}
