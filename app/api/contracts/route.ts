import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { resolveContractActor } from '@/lib/auth-contract';
import { clearedRepEnteredBilling, newContractBodySchema, sponsorBrandFromBody } from '@/lib/contract-schemas';
import {
  normalizeSignerCcEmail,
  normalizeSignerCcName,
} from '@/lib/docusign-signer-cc';
import { replaceContractBoothBrandsForContract, clearContractBoothBrandsForContract } from '@/lib/contract-booth-brands';
import { replaceContractLineItemsForContract } from '@/lib/contract-line-items';
import { eventTemplateProfile, isEventsManagedWorkflow } from '@/lib/contract-template-profile';
import { isNyweVendorEvent, applyNyweLicensePricingIfNeeded, signerTitleForContract } from '@/lib/nywe-pricing';
import { billingFieldsFromOptionalBody } from '@/lib/nywe-billing';
import { isDiscountedRate } from '@/lib/contracts';
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

  return NextResponse.json({ contracts: data ?? [] });
}

export async function POST(req: Request) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = newContractBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const p = parsed.data;
  const supabase = getSupabaseAdmin();
  const { actor } = gate;

  const { data: eventRow } = await supabase.from('events').select('*').eq('id', p.event_id).single<Event>();
  if (!eventRow) {
    return NextResponse.json({ error: 'Event not found' }, { status: 400 });
  }

  const eventsManaged = isEventsManagedWorkflow(eventRow);
  if (!eventsManaged && !p.sales_rep_id) {
    return NextResponse.json({ error: 'Sales rep is required for this event.' }, { status: 400 });
  }
  if (eventsManaged && !actor.isEventsTeam && !actor.isAdmin) {
    return NextResponse.json({ error: 'Only events team can create contracts for this event.' }, { status: 403 });
  }

  let effectiveSalesRepId: string | null = p.sales_rep_id ?? null;

  if (effectiveSalesRepId) {
    if (actor.isAdmin) {
      const { data: repExists } = await supabase.from('sales_reps').select('id').eq('id', effectiveSalesRepId).maybeSingle();
      if (!repExists) {
        return NextResponse.json({ error: 'Invalid sales rep' }, { status: 400 });
      }
    } else if (!actor.accessibleSalesRepIds.includes(effectiveSalesRepId)) {
      return NextResponse.json({ error: 'Cannot assign contract to that sales rep' }, { status: 400 });
    }
  }

  const bill = clearedRepEnteredBilling();
  const rosterBilling =
    eventTemplateProfile(eventRow) === 'nywe_vendor' ? billingFieldsFromOptionalBody(p) : null;

  const nywePricing = applyNyweLicensePricingIfNeeded(eventRow, {
    booth_count: p.booth_count,
    booth_rate_cents: p.booth_rate_cents,
  });
  const nyweLineItems = isNyweVendorEvent(eventRow) ? [] : (p.line_items ?? []);

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
      brands_poured: p.order_type === 'sponsorship_only' ? sponsorBrandFromBody(p) : null,
      booth_count: nywePricing.booth_count,
      booth_rate_cents: nywePricing.booth_rate_cents,
      signer_1_name: p.signer_1_name ?? null,
      signer_1_title: signerTitleForContract(eventRow, p.signer_1_title),
      signer_1_email: p.signer_1_email ?? null,
      signer_cc_name: normalizeSignerCcName(p.signer_cc_name),
      signer_cc_email: normalizeSignerCcEmail(p.signer_cc_email),
      sales_rep_id: isNyweVendorEvent(eventRow) ? null : effectiveSalesRepId,
      notes: p.notes ?? null,
      exhibitor_notes: p.exhibitor_notes?.trim() || null,
      created_by: actor.email,
      status: 'draft',
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
    await replaceContractLineItemsForContract(supabase, row.id, nyweLineItems);
    if (isNyweVendorEvent(eventRow)) {
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

  if (p.order_type !== 'sponsorship_only' && isDiscountedRate(row.booth_rate_cents, eventRow)) {
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
