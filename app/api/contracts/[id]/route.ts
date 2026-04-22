import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractStatus } from '@/types/db';

const patchSchema = z.object({
  signer_1_name:  z.string().min(1),
  signer_1_title: z.string().optional().nullable(),
  signer_1_email: z.string().email(),
});

const editableStatuses: ContractStatus[] = ['approved', 'ready_for_review'];

/** Update exhibitor signer contact fields before (or between) DocuSign sends. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, status, signer_1_email')
    .eq('id', params.id)
    .single();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  if (!editableStatuses.includes(contract.status as ContractStatus)) {
    return NextResponse.json(
      {
        error:
          'Signer details can only be edited when status is Approved or Ready for Review. Recall the DocuSign contract first if it was already sent.',
      },
      { status: 409 },
    );
  }

  const p = parsed.data;
  const { error } = await supabase
    .from('contracts')
    .update({
      signer_1_name:  p.signer_1_name,
      signer_1_title: p.signer_1_title ?? null,
      signer_1_email: p.signer_1_email,
    })
    .eq('id', params.id);

  if (error) {
    console.error('PATCH contract failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('audit_log').insert({
    contract_id: params.id,
    actor_email: session.user.email,
    action: 'signer_contact_updated',
    metadata: {
      previous_email: contract.signer_1_email,
      new_email: p.signer_1_email,
    },
  });

  return NextResponse.json({ ok: true });
}
