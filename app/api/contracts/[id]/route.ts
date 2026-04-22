import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { COUNTRIES } from '@/lib/countries';
import { STANDARD_BOOTH_RATE_CENTS } from '@/lib/contracts';
import type { ContractStatus } from '@/types/db';

const validCountries = new Set(COUNTRIES.map((c) => c.name));

const patchSchema = z.object({
  signer_1_name: z.string().min(1),
  signer_1_title: z.string().optional().nullable(),
  signer_1_email: z.string().email(),
  exhibitor_address_line1: z.string().trim().min(3),
  exhibitor_address_line2: z.string().trim().optional().nullable(),
  exhibitor_city: z.string().trim().min(1),
  exhibitor_state: z.string().trim().min(1),
  exhibitor_zip: z.string().trim().min(1),
  booth_rate_cents: z.number().int().min(0).optional(),
  exhibitor_country: z
    .string()
    .trim()
    .min(1)
    .refine((name) => validCountries.has(name), 'Country must be one of the supported countries'),
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
    .select('id, status, signer_1_email, booth_rate_cents, discount_approved_at, discount_approved_by')
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
  const incomingBoothRate = typeof p.booth_rate_cents === 'number' ? p.booth_rate_cents : contract.booth_rate_cents;
  const boothRateChanged = incomingBoothRate !== contract.booth_rate_cents;
  const shouldResetDiscountApproval =
    boothRateChanged &&
    (incomingBoothRate >= STANDARD_BOOTH_RATE_CENTS || incomingBoothRate < contract.booth_rate_cents);

  const { error } = await supabase
    .from('contracts')
    .update({
      signer_1_name:  p.signer_1_name,
      signer_1_title: p.signer_1_title ?? null,
      signer_1_email: p.signer_1_email,
      exhibitor_address_line1: p.exhibitor_address_line1,
      exhibitor_address_line2: p.exhibitor_address_line2 ?? null,
      exhibitor_city: p.exhibitor_city,
      exhibitor_state: p.exhibitor_state,
      exhibitor_zip: p.exhibitor_zip,
      exhibitor_country: p.exhibitor_country,
      booth_rate_cents: incomingBoothRate,
      ...(shouldResetDiscountApproval
        ? {
            discount_approved_at: null,
            discount_approved_by: null,
            discount_approval_reason: null,
          }
        : {}),
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
      address_updated: true,
    },
  });

  if (shouldResetDiscountApproval && contract.discount_approved_at) {
    await supabase.from('audit_log').insert({
      contract_id: params.id,
      actor_email: session.user.email,
      action: 'discount_approval_reset',
      metadata: {
        previous_approver: contract.discount_approved_by,
        old_rate: contract.booth_rate_cents,
        new_rate: incomingBoothRate,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
