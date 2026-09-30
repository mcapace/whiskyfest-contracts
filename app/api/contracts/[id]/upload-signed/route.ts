import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { attachClientSignedPdf, type UploadSignedCountersign } from '@/lib/contract-upload-signed';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Attach a client-signed PDF (signed outside DocuSign) to an existing contract: voids the
 * envelope, stores the PDF as the signed copy, then countersigns via DocuSign or marks it
 * fully signed and releases to accounting. Multipart: file, countersign ('docusign'|'none'),
 * note (optional internal + accounting note), reason (optional).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'The signed PDF is required.' }, { status: 400 });
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'The signed contract must be a PDF.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'PDF must be 15 MB or smaller.' }, { status: 400 });
  }
  const countersignRaw = String(form?.get('countersign') ?? 'docusign');
  const countersign: UploadSignedCountersign = countersignRaw === 'none' ? 'none' : 'docusign';
  const note = String(form?.get('note') ?? '').slice(0, 2000);
  const reason = String(form?.get('reason') ?? '').slice(0, 500);

  try {
    const result = await attachClientSignedPdf({
      supabase: getSupabaseAdmin(),
      contractId: params.id,
      actorEmail: gate.actor.email,
      pdfBytes: Buffer.from(await file.arrayBuffer()),
      countersign,
      note,
      reason,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Attaching the signed PDF failed';
    console.error('[upload-signed]', params.id, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
