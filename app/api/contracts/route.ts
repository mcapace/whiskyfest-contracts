import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { resolveContractActor } from '@/lib/auth-contract';
import { newContractBodySchema, normalizedBillingColumns } from '@/lib/contract-schemas';
import { isDiscountedRate } from '@/lib/contracts';
import { notifyAdminsOfDiscountRequest } from '@/lib/notifications';
import type { Contract } from '@/types/db';
import type { ContractStatus } from '@/types/db';

export const dynamic = 'force-dynamic';

const VALID: ContractStatus[] = [
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
  'sent',
  'partially_signed',
  'signed',
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
  let query = supabase.from('contracts_with_totals').select('*').order('created_at', { ascending: false }).limit(200);

  const scopeAll = gate.actor.isAdmin || gate.actor.isEventsTeam;
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
    query = query.ilike('exhibitor_company_name', `%${q}%`);
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

  let effectiveSalesRepId = p.sales_rep_id;

  if (actor.isAdmin) {
    const { data: repExists } = await supabase.from('sales_reps').select('id').eq('id', p.sales_rep_id).maybeSingle();
    if (!repExists) {
      return NextResponse.json({ error: 'Invalid sales rep' }, { status: 400 });
    }
  } else {
    if (!actor.accessibleSalesRepIds.includes(p.sales_rep_id)) {
      return NextResponse.json({ error: 'Cannot assign contract to that sales rep' }, { status: 400 });
    }
    effectiveSalesRepId = p.sales_rep_id;
  }

  const addrSlice = {
    exhibitor_address_line1: p.exhibitor_address_line1 ?? null,
    exhibitor_address_line2: p.exhibitor_address_line2 ?? null,
    exhibitor_city: p.exhibitor_city ?? null,
    exhibitor_state: p.exhibitor_state ?? null,
    exhibitor_zip: p.exhibitor_zip ?? null,
    exhibitor_country: p.exhibitor_country ?? null,
  };

  const bill = normalizedBillingColumns(p);

  const { data: assignedRepLookup } = await supabase
    .from('sales_reps')
    .select('name, email')
    .eq('id', effectiveSalesRepId)
    .single();

  const assignedRepEmailNorm = assignedRepLookup?.email?.trim().toLowerCase() ?? '';
  const creatorIsAssignedRep = assignedRepEmailNorm === actor.email.toLowerCase();
  const onBehalfMetadata = !creatorIsAssignedRep;

  const { data, error } = await supabase
    .from('contracts')
    .insert({
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
      booth_rate_cents: p.booth_rate_cents,
      signer_1_name: p.signer_1_name ?? null,
      signer_1_title: p.signer_1_title ?? null,
      signer_1_email: p.signer_1_email ?? null,
      sales_rep_id: effectiveSalesRepId,
      notes: p.notes ?? null,
      created_by: actor.email,
      status: 'draft',
      ...bill,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create contract:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data as Contract;

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

  const grandTotalCents = row.booth_count * row.booth_rate_cents;
  if (isDiscountedRate(row.booth_rate_cents)) {
    try {
      await notifyAdminsOfDiscountRequest(
        {
          ...row,
          grand_total_cents: grandTotalCents,
        },
        { email: actor.email, name: actor.appUser.name ?? undefined },
      );
    } catch (e) {
      console.error('notifyAdminsOfDiscountRequest failed:', e);
    }
  }

  return NextResponse.json({ id: row.id });
}
