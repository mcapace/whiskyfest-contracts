import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { STANDARD_BOOTH_RATE_CENTS } from '@/lib/contracts';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { assertContractAccess } from '@/lib/auth-contract';
import { newContractBodySchema, normalizedBillingColumns, signerContactPatchSchema } from '@/lib/contract-schemas';
import type { ContractStatus } from '@/types/db';

const signerEditableStatuses: ContractStatus[] = ['approved', 'ready_for_review', 'pending_events_review'];

/** Signer/contact updates (pre-send) OR full draft edit. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id);
  if (!gate.ok) return gate.response;

  const { actor, contract } = gate;

  const body = await req.json().catch(() => null);
  const supabase = getSupabaseAdmin();

  if (contract.status === 'draft') {
    const parsed = newContractBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const contractRepId = contract.sales_rep_id;
    if (
      !actor.isAdmin &&
      (!contractRepId || !actor.accessibleSalesRepIds.includes(contractRepId))
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const p = parsed.data;

    let effectiveSalesRepId = p.sales_rep_id;
    if (actor.isAdmin) {
      const { data: repExists } = await supabase.from('sales_reps').select('id').eq('id', p.sales_rep_id).maybeSingle();
      if (!repExists) return NextResponse.json({ error: 'Invalid sales rep' }, { status: 400 });
    } else {
      if (!actor.accessibleSalesRepIds.includes(p.sales_rep_id)) {
        return NextResponse.json({ error: 'Cannot reassign sales rep' }, { status: 400 });
      }
      effectiveSalesRepId = p.sales_rep_id;
    }

    const incomingBoothRate = p.booth_rate_cents;
    const boothRateChanged = incomingBoothRate !== contract.booth_rate_cents;
    const shouldResetDiscountApproval =
      boothRateChanged &&
      (incomingBoothRate >= STANDARD_BOOTH_RATE_CENTS || incomingBoothRate < contract.booth_rate_cents);

    const addrSlice = {
      exhibitor_address_line1: p.exhibitor_address_line1 ?? null,
      exhibitor_address_line2: p.exhibitor_address_line2 ?? null,
      exhibitor_city: p.exhibitor_city ?? null,
      exhibitor_state: p.exhibitor_state ?? null,
      exhibitor_zip: p.exhibitor_zip ?? null,
      exhibitor_country: p.exhibitor_country ?? null,
    };

    const bill = normalizedBillingColumns(p);

    const { error } = await supabase
      .from('contracts')
      .update({
        event_id: p.event_id,
        exhibitor_legal_name: p.exhibitor_legal_name,
        exhibitor_company_name: p.exhibitor_company_name,
        exhibitor_address_line1: addrSlice.exhibitor_address_line1,
        exhibitor_address_line2: addrSlice.exhibitor_address_line2,
        exhibitor_city: addrSlice.exhibitor_city,
        exhibitor_state: addrSlice.exhibitor_state,
        exhibitor_zip: addrSlice.exhibitor_zip,
        exhibitor_country: addrSlice.exhibitor_country,
        exhibitor_telephone: p.exhibitor_telephone ?? null,
        brands_poured: p.brands_poured ?? null,
        booth_count: p.booth_count,
        booth_rate_cents: incomingBoothRate,
        signer_1_name: p.signer_1_name ?? null,
        signer_1_title: p.signer_1_title ?? null,
        signer_1_email: p.signer_1_email ?? null,
        sales_rep_id: effectiveSalesRepId,
        notes: p.notes ?? null,
        ...bill,
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
      console.error('PATCH draft contract failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (shouldResetDiscountApproval && contract.discount_approved_at) {
      await supabase.from('audit_log').insert({
        contract_id: params.id,
        actor_email: actor.email,
        action: 'discount_approval_reset',
        metadata: {
          previous_approver: contract.discount_approved_by,
          old_rate: contract.booth_rate_cents,
          new_rate: incomingBoothRate,
        },
      });
    }

    revalidateContractPaths(params.id);
    return NextResponse.json({ ok: true });
  }

  if (!signerEditableStatuses.includes(contract.status as ContractStatus)) {
    return NextResponse.json(
      {
        error:
          'Updates are only allowed for draft contracts, or signer contact edits for Approved / Ready for Review (admins only for the latter).',
      },
      { status: 409 },
    );
  }

  if (!actor.isAdmin) {
    return NextResponse.json(
      { error: 'Only admins can edit exhibitor contact details at this stage.' },
      { status: 403 },
    );
  }

  const parsed = signerContactPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
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
      signer_1_name: p.signer_1_name,
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
    actor_email: actor.email,
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
      actor_email: actor.email,
      action: 'discount_approval_reset',
      metadata: {
        previous_approver: contract.discount_approved_by,
        old_rate: contract.booth_rate_cents,
        new_rate: incomingBoothRate,
      },
    });
  }

  revalidateContractPaths(params.id);

  return NextResponse.json({ ok: true });
}
