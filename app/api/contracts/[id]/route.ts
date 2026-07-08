import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { STANDARD_BOOTH_RATE_CENTS } from '@/lib/contracts';
import { notifyAdminsIfNewlyRequiresDiscountApproval } from '@/lib/discount-patch-notify';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { assertContractAccess } from '@/lib/auth-contract';
import {
  clearedRepEnteredBilling,
  firstContractBodyValidationError,
  newContractBodySchema,
  signerContactPatchSchema,
  sponsorBrandFromBody,
} from '@/lib/contract-schemas';
import { replaceContractBoothBrandsForContract, clearContractBoothBrandsForContract } from '@/lib/contract-booth-brands';
import { replaceContractLineItemsForContract } from '@/lib/contract-line-items';
import {
  normalizeSignerCcEmail,
  normalizeSignerCcName,
} from '@/lib/docusign-signer-cc';
import type { Contract, ContractStatus } from '@/types/db';
import { isLegacyImportedContract } from '@/lib/legacy-import';
import { billingFieldsFromOptionalBody } from '@/lib/nywe-billing';
import { refreshNyweBillingFromRosterForContract } from '@/lib/nywe-roster-billing-sync';
import { applyNyweLicensePricingIfNeeded, isNyweVendorEvent, signerTitleForContract } from '@/lib/nywe-pricing';
import {
  assertNoChargeBoothAllowed,
  isNoChargeBoothContract,
  noChargeBoothFieldsForInsert,
} from '@/lib/no-charge-booth';
import type { Event } from '@/types/db';

const signerEditableStatuses: ContractStatus[] = ['approved', 'ready_for_review', 'pending_events_review'];

/** Signer/contact updates (pre-send) OR full draft edit. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id);
  if (!gate.ok) return gate.response;

  const { actor, contract } = gate;

  const body = await req.json().catch(() => null);
  const supabase = getSupabaseAdmin();

  if (
    contract.status === 'draft' ||
    contract.status === 'imported' ||
    contract.status === 'voided' ||
    (contract.status === 'pending_events_review' && isLegacyImportedContract(contract))
  ) {
    const parsed = newContractBodySchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return NextResponse.json(
        { error: firstContractBodyValidationError(flat), details: flat },
        { status: 400 },
      );
    }

    if (contract.status === 'imported' || contract.status === 'voided') {
      if (!actor.isAdmin && !actor.isEventsTeam) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (contract.status === 'pending_events_review' && isLegacyImportedContract(contract)) {
      if (!actor.isAdmin && !actor.isEventsTeam) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      const contractRepId = contract.sales_rep_id;
      if (
        !actor.isAdmin &&
        (!contractRepId || !actor.accessibleSalesRepIds.includes(contractRepId))
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const p = parsed.data;

    const { data: patchEventFull } = await supabase.from('events').select('*').eq('id', p.event_id).maybeSingle<Event>();
    if (!patchEventFull) {
      return NextResponse.json({ error: 'Event not found' }, { status: 400 });
    }

    let effectiveSalesRepId: string | null = p.sales_rep_id ?? null;
    if (effectiveSalesRepId) {
      if (actor.isAdmin) {
        const { data: repExists } = await supabase
          .from('sales_reps')
          .select('id')
          .eq('id', effectiveSalesRepId)
          .maybeSingle();
        if (!repExists) return NextResponse.json({ error: 'Invalid sales rep' }, { status: 400 });
      } else if (!actor.accessibleSalesRepIds.includes(effectiveSalesRepId)) {
        return NextResponse.json({ error: 'Cannot reassign sales rep' }, { status: 400 });
      }
    }

    const incomingBoothRate = p.booth_rate_cents;
    const patchEvent = patchEventFull;
    const nyweEvent = isNyweVendorEvent(patchEvent);
    const noChargeRequested = Boolean(p.no_charge_booth);
    const noChargeGate = await assertNoChargeBoothAllowed({
      actorEmail: actor.email,
      salesRepId: effectiveSalesRepId,
      event: patchEvent,
      orderType: p.order_type,
      noChargeRequested,
    });
    if (!noChargeGate.ok) {
      return NextResponse.json({ error: noChargeGate.error }, { status: 400 });
    }

    const wasNoCharge = isNoChargeBoothContract(contract as Contract);
    const becomingNoCharge = noChargeRequested && !wasNoCharge;
    const leavingNoCharge = !noChargeRequested && wasNoCharge;

    const bill = nyweEvent ? {} : clearedRepEnteredBilling();
    const nywePricing = applyNyweLicensePricingIfNeeded(patchEvent, {
      booth_count: p.booth_count,
      booth_rate_cents: noChargeRequested ? 0 : incomingBoothRate,
    });
    const boothRateChanged = nywePricing.booth_rate_cents !== contract.booth_rate_cents;
    const nyweLineItems = nyweEvent ? [] : (p.line_items ?? []);
    const shouldResetDiscountApproval =
      !noChargeRequested &&
      !nyweEvent &&
      boothRateChanged &&
      (nywePricing.booth_rate_cents >= STANDARD_BOOTH_RATE_CENTS ||
        nywePricing.booth_rate_cents < contract.booth_rate_cents);

    const nyweBilling = nyweEvent ? billingFieldsFromOptionalBody(p) : null;

    if (nyweEvent) {
      effectiveSalesRepId = null;
    }

    const reopeningVoided = contract.status === 'voided';

    const { error } = await supabase
      .from('contracts')
      .update({
        event_id: p.event_id,
        exhibitor_legal_name: p.exhibitor_legal_name,
        exhibitor_company_name: p.exhibitor_company_name,
        order_type: p.order_type ?? 'booth',
        brands_poured: nyweEvent
          ? (p.brands_poured?.trim() || p.exhibitor_company_name.trim() || null)
          : p.order_type === 'sponsorship_only'
            ? sponsorBrandFromBody(p)
            : null,
        booth_count: nywePricing.booth_count,
        booth_rate_cents: nywePricing.booth_rate_cents,
        signer_1_name: p.signer_1_name ?? null,
        signer_1_title: signerTitleForContract(patchEvent, p.signer_1_title),
        signer_1_email: p.signer_1_email ?? null,
        signer_cc_name: normalizeSignerCcName(p.signer_cc_name),
        signer_cc_email: normalizeSignerCcEmail(p.signer_cc_email),
        sales_rep_id: effectiveSalesRepId,
        notes: p.notes ?? null,
        exhibitor_notes: p.exhibitor_notes?.trim() || null,
        no_charge_booth: noChargeRequested,
        ...(becomingNoCharge ? noChargeBoothFieldsForInsert(actor.email) : {}),
        ...(leavingNoCharge
          ? {
              invoice_status: 'pending',
              ...(nywePricing.booth_rate_cents < STANDARD_BOOTH_RATE_CENTS
                ? {
                    discount_approved_at: null,
                    discount_approved_by: null,
                    discount_approval_reason: null,
                  }
                : {}),
            }
          : {}),
        ...(reopeningVoided
          ? {
              status: 'draft',
              docusign_envelope_id: null,
              sent_at: null,
              signed_at: null,
              countersigned_at: null,
              countersigned_by_email: null,
              countersigned_by_name: null,
              executed_at: null,
              voided_at: null,
              voided_by: null,
              voided_reason: null,
              events_approved_at: null,
              events_approved_by: null,
              events_approval_reason: null,
            }
          : {}),
        ...bill,
        ...(nyweBilling ?? {}),
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

    try {
      await replaceContractLineItemsForContract(supabase, params.id, nyweLineItems);
      if (nyweEvent) {
        await clearContractBoothBrandsForContract(supabase, params.id);
      } else {
        await replaceContractBoothBrandsForContract(
          supabase,
          params.id,
          nywePricing.booth_count,
          p.booth_brands ?? [],
        );
      }
    } catch (e) {
      console.error('Failed to save contract line items:', e);
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to save line items' }, { status: 500 });
    }

    if (shouldResetDiscountApproval && contract.discount_approved_at) {
      await supabase.from('audit_log').insert({
        contract_id: params.id,
        actor_email: actor.email,
        action: 'discount_approval_reset',
        metadata: {
          previous_approver: contract.discount_approved_by,
          old_rate: contract.booth_rate_cents,
          new_rate: nywePricing.booth_rate_cents,
        },
      });
    }

    await notifyAdminsIfNewlyRequiresDiscountApproval({
      contractId: params.id,
      before: contract as Contract,
      incomingBoothRate: nywePricing.booth_rate_cents,
      shouldResetDiscountApproval: shouldResetDiscountApproval && !noChargeRequested,
      editor: { email: actor.email, name: actor.appUser?.name },
    });

    revalidateContractPaths(params.id);

    if (reopeningVoided && patchEvent && nyweEvent) {
      const { data: withTotals } = await supabase
        .from('contracts_with_totals')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();
      if (withTotals) {
        await refreshNyweBillingFromRosterForContract(supabase, withTotals, patchEvent as Event);
      }
    }

    if (contract.status === 'voided') {
      await supabase.from('audit_log').insert({
        contract_id: params.id,
        actor_email: actor.email,
        action: 'voided_contract_reopened_for_edit',
        from_status: 'voided',
        to_status: 'draft',
      });
    }
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
  const { data: signerPatchEvent } = await supabase
    .from('events')
    .select('contract_template_profile, booth_rate_cents')
    .eq('id', contract.event_id)
    .maybeSingle<Pick<Event, 'contract_template_profile' | 'booth_rate_cents'>>();
  const incomingBoothRate =
    typeof p.booth_rate_cents === 'number' ? p.booth_rate_cents : contract.booth_rate_cents;
  const normalizedRate = signerPatchEvent
    ? applyNyweLicensePricingIfNeeded(signerPatchEvent, {
        booth_count: contract.booth_count,
        booth_rate_cents: incomingBoothRate,
      }).booth_rate_cents
    : incomingBoothRate;
  const boothRateChanged = normalizedRate !== contract.booth_rate_cents;
  const shouldResetDiscountApproval =
    !isNyweVendorEvent(signerPatchEvent) &&
    boothRateChanged &&
    (normalizedRate >= STANDARD_BOOTH_RATE_CENTS || normalizedRate < contract.booth_rate_cents);

  const { error } = await supabase
    .from('contracts')
    .update({
      signer_1_name: p.signer_1_name,
      signer_1_title: signerTitleForContract(signerPatchEvent, p.signer_1_title),
      signer_1_email: p.signer_1_email,
      signer_cc_name: normalizeSignerCcName(p.signer_cc_name),
      signer_cc_email: normalizeSignerCcEmail(p.signer_cc_email),
      booth_rate_cents: normalizedRate,
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
      previous_cc_email: contract.signer_cc_email,
      new_cc_email: normalizeSignerCcEmail(p.signer_cc_email),
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
        new_rate: normalizedRate,
      },
    });
  }

  await notifyAdminsIfNewlyRequiresDiscountApproval({
    contractId: params.id,
    before: contract as Contract,
    incomingBoothRate: normalizedRate,
    shouldResetDiscountApproval,
    editor: { email: actor.email, name: actor.appUser?.name },
  });

  revalidateContractPaths(params.id);

  return NextResponse.json({ ok: true });
}
