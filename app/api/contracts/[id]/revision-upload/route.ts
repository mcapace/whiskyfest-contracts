import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { storeRevisionUpload } from '@/lib/contract-revision';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Contract } from '@/types/db';

export const runtime = 'nodejs';

const MAX_BYTES = 15 * 1024 * 1024;

/** Upload a client redlined PDF for a revise-and-send workflow. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase.from('contracts').select('status').eq('id', params.id).maybeSingle<Contract>();
  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json(
      { error: 'Upload revisions while the contract is sent or partially signed.' },
      { status: 409 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'PDF file is required.' }, { status: 400 });
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF uploads are supported.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'PDF must be 15 MB or smaller.' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const path = await storeRevisionUpload(params.id, bytes);
    revalidateContractPaths(params.id);
    return NextResponse.json({ ok: true, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
