import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { AMENDMENT_IMPORT_MAX_BYTES, extractAmendmentsText } from '@/lib/amendments-import';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Extract the text of a client's amendments file (PDF, Word, text, saved email) so it can be
 * reviewed and turned into inline contract edits. Nothing is stored.
 */
export async function POST(req: Request) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
  }
  if (file.size > AMENDMENT_IMPORT_MAX_BYTES) {
    return NextResponse.json({ error: 'File must be 15 MB or smaller.' }, { status: 400 });
  }

  try {
    const text = await extractAmendmentsText({
      name: file.name,
      type: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    if (!text.trim()) {
      return NextResponse.json(
        { error: 'No readable text was found in that file. If it is a scanned PDF, paste the amendments instead.' },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, text, file_name: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read the file';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
