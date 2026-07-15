import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { resolveContractActor } from '@/lib/auth-contract';
import { portalKindFromHost, productKeyForPortalKind } from '@/lib/portal-host';
import { scopeContractsByProduct } from '@/lib/product-portal';
import { clearedRepEnteredBilling, firstContractBodyValidationError, newContractBodySchema, sponsorBrandFromBody } from '@/lib/contract-schemas';
import {
  normalizeSignerCcEmail,
  normalizeSignerCcName,
} from '@/lib/docusign-signer-cc';
import { replaceContractBoothBrandsForContract, clearContractBoothBrandsForContract } from '@/lib/contract-booth-brands';
import { replaceContractLineItemsForContract } from '@/lib/contract-line-items';
import { eventTemplateProfile, isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import {
  applyNyweLicensePricingIfNeeded,
  isNyweVendorOnlyEvent,
  signerTitleForContract,
} from '@/lib/nywe-pricing';
import { pricingFromBigSmokeInput } from '@/lib/big-smoke-pricing';
import { billingFieldsFromOptionalBody } from '@/lib/nywe-billing';
import { isDiscountedRate } from '@/lib/contracts';
import {
  assertNoChargeBoothAllowed,
  isNoChargeBoothContract,
  noChargeBoothFieldsForInsert,
} from '@/lib/no-charge-booth';
import { notifyAdminsOfDiscountRequest } from '@/lib/notifications';
import type { Contract, ContractWithTotals, Event } from '@/types/db';
import type { ContractStatus } from '@/types/db';

export const dynamic = 'force-dynamic';

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
}

const VALID: ContractStatus[] = [
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'signed',
  'imported',
  'executed',
  'voided',
  'cancelled',
  'error',
];

/** List contracts — admins see all; sales reps see only rows they own. */
export async function GET(req: Request) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim();

  const supabase = getSupabaseAdmin();
  let query = supabase.from('contracts_with_totals').select('*').order('created_at', { ascending: false });

  const scopeAll = gate.actor.canViewAllSales;
  if (!scopeAll && gate.actor.accessibleSalesRepIds.length > 0) {
    query = query.in('sales_rep_id', gate.actor.accessibleSalesRepIds);
  }

  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'draft') {
      query = query.or('status.eq.draft,status.eq.ready_for_review');
    } else if (VALID.includes(statusFilter as ContractStatus)) {
      query = query.eq('status', statusFilter as ContractStatus);
    }
  }

  if (q) {
    const safe = escapeIlikePattern(q);
    const pattern = `%${safe}%`;
    const { data: boothRows } = await supabase.from('contract_booth_brands').select('contract_id').ilike('brand_name', pattern);
    const boothIds = [...new Set((boothRows ?? []).map((r) => r.contract_id as string))];
    const parts = [
      `exhibitor_company_name.ilike.${pattern}`,
      `brands_poured.ilike.${pattern}`,
      `signer_1_name.ilike.${pattern}`,
      `signer_1_email.ilike.${pattern}`,
    ];
    if (boothIds.length > 0) {
      parts.push(`id.in.(${boothIds.join(',')})`);
    }
    query = query.or(parts.join(','));
    query = query.limit(5);
  } else {
    query = query.limit(200);
  }

  const { data, error } = await query;

  if (error) {
    console.error('GET contracts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const portalKind = portalKindFromHost(req.headers.get('host'));
  const productKey = productKeyForPortalKind(portalKind);
  const { data: eventsData } = await supabase.from('events').select('*');
  const scoped = scopeContractsByProduct(
    (data ?? []) as ContractWithTotals[],
    (eventsData ?? []) as Event[],
    productKey,
  );

  return NextResponse.json({ contracts: scoped });
}

export async function POST(req: Request) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = newContractBodySchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return NextResponse.json({ error: firstContractBodyValidationError(flat), details: flat }, { status: 400 });
  }

  const p = parsed.data;
  const supabase = getSupabaseAdmin();
  const { actor } = gate;

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', p.event_id).single<Event>();
  if (!eventRow) {
    return NextResponse.json({ error: 'Event not found' }, { status: 400 });
  }

  const profile = eventTemplateProfile(eventRow);
  const isBigSmoke = profile === 'big_smoke';
  const requiresSalesRep = isBigSmoke || !isNyweEventsManagedEvent(eventRow);

  if (requiresSalesRep && !p.sales_rep_id) {
    return NextResponse.json({ error: 'Sales rep is required for this event.' }, { status: 400 });
  }
  // NYWE events-managed: events team / admin only. Big Smoke uses sales pipeline like WhiskyFest.
  if (isNyweEventsManagedEvent(eventRow) && !actor.isEventsTeam && !actor.isAdmin) {
    return NextResponse.json({ error: 'Only events team can create contracts for this event.' }, { status: 403 });
  }

  let effectiveSalesRepId: string | null = p.sales_rep_id ?? null;

  if (effectiveSalesRepId) {
    if (actor.isAdmin || actor.canViewAllSales) {
      const { data: repExists } = await supabase.from('sales_reps').select('id').eq('id', effectiveSalesRepId).maybeSingle();
      if (!repExists) {
        return NextResponse.json({ error: 'Invalid sales rep' }, { status: 400 });
      }
    } else if (!actor.accessibleSalesRepIds.includes(effectiveSalesRepId)) {
      return NextResponse.json({ error: 'Cannot assign contract to that sales rep' }, { status: 400 });
    }
  }

  const bill = clearedRepEnteredBilling();
  const nyweOnly = profile === 'nywe_vendor';
  const sponsorshipOnly = p.order_type === 'sponsorship_only';
  const rosterBilling =
    nyweOnly || isBigSmoke ? billingFieldsFromOptionalBody(p) : null;

  const noChargeRequested = Boolean(p.no_charge_booth);
  const bigSmokePricing =
    isBigSmoke && !sponsorshipOnly && !noChargeRequested
      ? pricingFromBigSmokeInput({
          package_selections: p.package_selections,
          package_key: p.package_key,
        })
      : null;
  const nywePricing = applyNyweLicensePricingIfNeeded(eventRow, {
    booth_count: bigSmokePricing?.booth_count ?? p.booth_count,
    booth_rate_cents: noChargeRequested
      ? 0
      : (bigSmokePricing?.booth_rate_cents ?? p.booth_rate_cents),
  });
  // NYWE licenses are flat — no line items. Big Smoke + WhiskyFest allow sponsorship line items.
  const savedLineItems = nyweOnly ? [] : (p.line_items ?? []);
  const packageKey = bigSmokePricing?.package_key ?? null;
  const packageSelections = bigSmokePricing?.package_selections ?? null;

  const noChargeGate = await assertNoChargeBoothAllowed({
    actorEmail: actor.email,
    salesRepId: effectiveSalesRepId,
    event: eventRow,
    orderType: p.order_type,
    noChargeRequested,
  });
  if (!noChargeGate.ok) {
    return NextResponse.json({ error: noChargeGate.error }, { status: 400 });
  }

  const { data: assignedRepLookup } = effectiveSalesRepId
    ? await supabase.from('sales_reps').select('name, email').eq('id', effectiveSalesRepId).single()
    : { data: null };

  const assignedRepEmailNorm = assignedRepLookup?.email?.trim().toLowerCase() ?? '';
  const creatorIsAssignedRep = effectiveSalesRepId ? assignedRepEmailNorm === actor.email.toLowerCase() : true;
  const onBehalfMetadata = !creatorIsAssignedRep;

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      event_id: p.event_id,
      exhibitor_legal_name: p.exhibitor_legal_name,
      exhibitor_company_name: p.exhibitor_company_name,
      order_type: p.order_type ?? 'booth',
      brands_poured: nyweOnly
        ? (p.brands_poured?.trim() || p.exhibitor_company_name.trim() || null)
        : sponsorshipOnly
          ? sponsorBrandFromBody(p)
          : isBigSmoke
            ? p.exhibitor_company_name.trim() || null
            : null,
      package_key: packageKey,
      package_selections: noChargeRequested || sponsorshipOnly ? null : packageSelections,
      booth_count: nywePricing.booth_count,
      booth_rate_cents: nywePricing.booth_rate_cents,
      signer_1_name: p.signer_1_name ?? null,
      signer_1_title: signerTitleForContract(eventRow, p.signer_1_title),
      signer_1_email: p.signer_1_email ?? null,
      signer_cc_name: normalizeSignerCcName(p.signer_cc_name),
      signer_cc_email: normalizeSignerCcEmail(p.signer_cc_email),
      sales_rep_id: isNyweVendorOnlyEvent(eventRow) ? null : effectiveSalesRepId,
      notes: p.notes ?? null,
      exhibitor_notes: p.exhibitor_notes?.trim() || null,
      created_by: actor.email,
      status: 'draft',
      ...(noChargeRequested ? noChargeBoothFieldsForInsert(actor.email) : {}),
      ...bill,
      ...(rosterBilling ?? {}),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create contract:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data as Contract;

  try {
    await replaceContractLineItemsForContract(supabase, row.id, savedLineItems);
    if (nyweOnly || isBigSmoke) {
      await clearContractBoothBrandsForContract(supabase, row.id);
    } else {
      await replaceContractBoothBrandsForContract(supabase, row.id, nywePricing.booth_count, p.booth_brands ?? []);
    }
  } catch (e) {
    console.error('Failed to save contract line items:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to save line items' }, { status: 500 });
  }

  await supabase.from('audit_log').insert({
    contract_id: row.id,
    actor_email: actor.email,
    action: 'contract_created',
    to_status: 'draft',
    metadata: {
      created_by: actor.email,
      sales_rep_name: assignedRepLookup?.name ?? null,
      sales_rep_email: assignedRepLookup?.email ?? null,
      ...(onBehalfMetadata
        ? {
            on_behalf_of: true,
            created_by_name: actor.appUser.name ?? actor.email,
            rep_name: assignedRepLookup?.name ?? null,
          }
        : {}),
    },
  });

  revalidateContractPaths(row.id);

  if (
    !noChargeRequested &&
    p.order_type !== 'sponsorship_only' &&
    isDiscountedRate(row.booth_rate_cents, eventRow)
  ) {
    try {
      const { data: withTotals } = await supabase
        .from('contracts_with_totals')
        .select('*')
        .eq('id', row.id)
        .maybeSingle();
      if (withTotals) {
        await notifyAdminsOfDiscountRequest(withTotals as ContractWithTotals, {
          email: actor.email,
          name: actor.appUser.name ?? undefined,
        });
      }
    } catch (e) {
      console.error('notifyAdminsOfDiscountRequest failed:', e);
    }
  }

  return NextResponse.json({ id: row.id });
}
