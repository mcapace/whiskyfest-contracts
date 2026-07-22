import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchBoothBrandsByContractIds } from '@/lib/contract-booth-brand-queries';
import { PRODUCT_WHISKYFEST } from '@/lib/product-portal';
import {
  fetchLiveParticipationSheetRows,
  resolveRepIdFromInitials,
  type LiveSheetPipelineRow,
} from '@/lib/participation-sheets-live';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  brandsFromContract,
  companiesMatch,
  contractIsConfirmed,
  contractIsGraduated,
  normalizeCompanyKey,
  pipelineStatusLabel,
  salesRepInitials,
  sponsorshipFromContract,
  type ParticipationReport,
  type ParticipationReportRow,
  type PipelineSection,
  type WfPipelineTarget,
} from '@/lib/participation-report-shared';
import type { ContractWithTotals, Event, SalesRep } from '@/types/db';

export * from '@/lib/participation-report-shared';

async function resolveWhiskyfestEvent(
  supabase: SupabaseClient,
  eventId?: string | null,
): Promise<Event | null> {
  if (eventId) {
    const { data } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    return (data as Event | null) ?? null;
  }
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('product_key', PRODUCT_WHISKYFEST)
    .eq('is_active', true)
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Event | null) ?? null;
}

function findMatchingContract(
  companyName: string,
  linkedId: string | null,
  byId: Map<string, ContractWithTotals>,
  all: ContractWithTotals[],
): ContractWithTotals | null {
  if (linkedId && byId.has(linkedId)) return byId.get(linkedId)!;
  for (const c of all) {
    if (companiesMatch(companyName, c.exhibitor_company_name)) return c;
  }
  return null;
}

function findPortalTarget(
  companyName: string,
  section: PipelineSection,
  targets: WfPipelineTarget[],
): WfPipelineTarget | null {
  for (const t of targets) {
    if (t.section !== section) continue;
    if (companiesMatch(companyName, t.company_name)) return t;
  }
  return null;
}

function confirmedRow(
  contract: ContractWithTotals,
  brandNames: string[],
): ParticipationReportRow {
  const sponsorship = sponsorshipFromContract(contract);
  return {
    id: contract.id,
    section: 'confirmed',
    company_name: contract.exhibitor_company_name,
    sales_rep_id: contract.sales_rep_id,
    sales_rep_name: contract.sales_rep_name,
    sales_rep_initials: salesRepInitials(contract.sales_rep_name, contract.sales_rep_email),
    brands_text: brandsFromContract(contract, brandNames),
    booth_count: contract.booth_count ?? 0,
    rate_per_booth_cents: contract.booth_rate_cents ?? 0,
    sponsorship_label: sponsorship.label,
    sponsorship_cents: sponsorship.cents,
    total_spend_cents: contract.grand_total_cents ?? contract.total_amount_cents ?? 0,
    notes: '',
    sheet_notes: '',
    pipeline_status: 'Executed',
    contract_id: contract.id,
    contract_status: contract.status,
    target_id: null,
  };
}

function isGraduatedOrConfirmed(
  companyName: string,
  match: ContractWithTotals | null,
  confirmedContracts: ContractWithTotals[],
): boolean {
  if (match && contractIsGraduated(match.status)) return true;
  return confirmedContracts.some((c) => companiesMatch(companyName, c.exhibitor_company_name));
}

function sheetDrivenRow(options: {
  sheet: LiveSheetPipelineRow;
  portal: WfPipelineTarget | null;
  contract: ContractWithTotals | null;
  brandNames: string[];
  salesReps: Pick<SalesRep, 'id' | 'name' | 'email'>[];
}): ParticipationReportRow {
  const { sheet, portal, contract, brandNames, salesReps } = options;
  const fromContract = contract && !contractIsGraduated(contract.status);
  const rep =
    salesReps.find((r) => r.id === portal?.sales_rep_id) ||
    salesReps.find((r) => {
      const email = r.email?.toLowerCase();
      const initials = salesRepInitials(r.name, r.email);
      return initials === sheet.rep_initials.toUpperCase() || email?.startsWith(sheet.rep_initials.toLowerCase());
    });

  const sponsorship = fromContract
    ? sponsorshipFromContract(contract)
    : { label: 'N' as string, cents: 0 };

  const portalNotes = portal?.notes?.trim() || '';
  const sheetNotes = sheet.sheet_notes?.trim() || '';

  return {
    id: portal?.id ?? `sheet:${sheet.section}:${normalizeCompanyKey(sheet.company_name)}`,
    section: sheet.section,
    company_name: sheet.company_name,
    sales_rep_id: portal?.sales_rep_id ?? rep?.id ?? null,
    sales_rep_name: portal?.sales_rep_name ?? rep?.name ?? null,
    sales_rep_initials: sheet.rep_initials || salesRepInitials(rep?.name, rep?.email),
    brands_text: fromContract
      ? brandsFromContract(contract, brandNames) || sheet.brands_text
      : sheet.brands_text,
    booth_count: fromContract ? contract.booth_count ?? sheet.booth_count : sheet.booth_count,
    rate_per_booth_cents: fromContract
      ? contract.booth_rate_cents ?? sheet.rate_per_booth_cents
      : sheet.rate_per_booth_cents,
    sponsorship_label: sponsorship.label,
    sponsorship_cents: sponsorship.cents,
    total_spend_cents: fromContract
      ? contract.grand_total_cents ?? sheet.total_spend_cents
      : sheet.total_spend_cents,
    notes: portalNotes,
    sheet_notes: sheetNotes,
    pipeline_status: pipelineStatusLabel(contract),
    contract_id: contract?.id ?? portal?.linked_contract_id ?? null,
    contract_status: contract?.status ?? null,
    target_id: portal?.id ?? null,
  };
}

/**
 * Ensure a portal target exists for a live sheet row so Kate can save notes.
 * Does not overwrite existing portal notes.
 */
async function ensurePortalTargetFromSheet(options: {
  supabase: SupabaseClient;
  eventId: string;
  sheet: LiveSheetPipelineRow;
  portal: WfPipelineTarget | null;
  repId: string | null;
}): Promise<string | null> {
  const { supabase, eventId, sheet, portal, repId } = options;
  if (portal?.id) {
    // Refresh structural fields from sheet; keep Kate's notes.
    await supabase
      .from('wf_pipeline_targets')
      .update({
        company_name: sheet.company_name,
        sales_rep_id: repId ?? portal.sales_rep_id,
        brands_text: sheet.brands_text || portal.brands_text,
        booth_count: sheet.booth_count,
        rate_per_booth_cents: sheet.rate_per_booth_cents,
        total_spend_cents: sheet.total_spend_cents,
        updated_at: new Date().toISOString(),
      })
      .eq('id', portal.id);
    return portal.id;
  }

  const { data, error } = await supabase
    .from('wf_pipeline_targets')
    .insert({
      event_id: eventId,
      section: sheet.section,
      company_name: sheet.company_name,
      sales_rep_id: repId,
      brands_text: sheet.brands_text || null,
      booth_count: sheet.booth_count,
      rate_per_booth_cents: sheet.rate_per_booth_cents,
      sponsorship_cents: 0,
      total_spend_cents: sheet.total_spend_cents,
      notes: null,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[participation] ensurePortalTarget', sheet.company_name, error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Build full participation report for the active WhiskyFest event. */
export async function buildParticipationReport(options?: {
  eventId?: string | null;
  supabase?: SupabaseClient;
}): Promise<ParticipationReport | null> {
  const supabase = options?.supabase ?? getSupabaseAdmin();
  const event = await resolveWhiskyfestEvent(supabase, options?.eventId);
  if (!event) return null;

  const [{ data: contractsData }, { data: targetsData }, { data: repsData }] = await Promise.all([
    supabase
      .from('contracts_with_totals')
      .select('*')
      .eq('event_id', event.id)
      .not('status', 'in', '("cancelled","voided")')
      .order('exhibitor_company_name'),
    supabase
      .from('wf_pipeline_targets')
      .select('*, sales_reps(name, email)')
      .eq('event_id', event.id)
      .eq('is_active', true)
      .order('company_name'),
    supabase.from('sales_reps').select('id, name, email').eq('is_active', true).order('name'),
  ]);

  const contracts = (contractsData ?? []) as ContractWithTotals[];
  const byId = new Map(contracts.map((c) => [c.id, c]));
  const contractIds = contracts.map((c) => c.id);
  const boothBrandRows = contractIds.length
    ? await fetchBoothBrandsByContractIds(supabase, contractIds)
    : [];
  const brandsByContract = new Map<string, string[]>();
  for (const row of boothBrandRows) {
    const cid = (row as { contract_id: string }).contract_id;
    const name = ((row as { brand_name?: string }).brand_name ?? '').trim();
    if (!name) continue;
    const list = brandsByContract.get(cid) ?? [];
    list.push(name);
    brandsByContract.set(cid, list);
  }

  const confirmedContracts = contracts.filter((c) => contractIsConfirmed(c.status));
  const confirmed = confirmedContracts.map((c) => confirmedRow(c, brandsByContract.get(c.id) ?? []));

  const salesReps = (repsData ?? []) as Pick<SalesRep, 'id' | 'name' | 'email'>[];
  const repByEmail = new Map(salesReps.map((r) => [r.email.toLowerCase(), r.id]));

  const targets: WfPipelineTarget[] = (targetsData ?? []).map((row) => {
    const r = row as WfPipelineTarget & {
      sales_reps?: { name: string | null; email: string | null } | null;
    };
    return {
      ...r,
      sales_rep_name: r.sales_reps?.name ?? null,
      sales_rep_email: r.sales_reps?.email ?? null,
    };
  });

  let sheetsFetchedAt: string | null = null;
  let sheetsError: string | null = null;
  let livePending: LiveSheetPipelineRow[] = [];
  let liveNewBiz: LiveSheetPipelineRow[] = [];

  try {
    const live = await fetchLiveParticipationSheetRows();
    livePending = live.pending;
    liveNewBiz = live.newBusiness;
    sheetsFetchedAt = live.fetchedAt;
  } catch (err) {
    sheetsError = err instanceof Error ? err.message : 'Failed to load Google Sheets';
    console.error('[participation] live sheets pull failed', err);
  }

  const pending: ParticipationReportRow[] = [];
  const newBusiness: ParticipationReportRow[] = [];
  const coveredPending = new Set<string>();
  const coveredNew = new Set<string>();

  for (const sheet of livePending) {
    const portal = findPortalTarget(sheet.company_name, 'pending_renewal', targets);
    const match = findMatchingContract(
      sheet.company_name,
      portal?.linked_contract_id ?? null,
      byId,
      contracts,
    );
    if (isGraduatedOrConfirmed(sheet.company_name, match, confirmedContracts)) continue;

    const repId = resolveRepIdFromInitials(sheet.rep_initials, repByEmail);
    const targetId = await ensurePortalTargetFromSheet({
      supabase,
      eventId: event.id,
      sheet,
      portal,
      repId,
    });
    const portalFresh = targetId
      ? ({
          ...(portal ?? {}),
          id: targetId,
          notes: portal?.notes ?? null,
          linked_contract_id: portal?.linked_contract_id ?? match?.id ?? null,
        } as WfPipelineTarget)
      : portal;

    const row = sheetDrivenRow({
      sheet,
      portal: portalFresh,
      contract: match,
      brandNames: match ? brandsByContract.get(match.id) ?? [] : [],
      salesReps,
    });
    if (targetId) row.target_id = targetId;
    pending.push(row);
    coveredPending.add(normalizeCompanyKey(sheet.company_name));
  }

  for (const sheet of liveNewBiz) {
    const portal = findPortalTarget(sheet.company_name, 'new_business', targets);
    const match = findMatchingContract(
      sheet.company_name,
      portal?.linked_contract_id ?? null,
      byId,
      contracts,
    );
    if (isGraduatedOrConfirmed(sheet.company_name, match, confirmedContracts)) continue;

    const repId = resolveRepIdFromInitials(sheet.rep_initials, repByEmail);
    const targetId = await ensurePortalTargetFromSheet({
      supabase,
      eventId: event.id,
      sheet,
      portal,
      repId,
    });
    const portalFresh = targetId
      ? ({
          ...(portal ?? {}),
          id: targetId,
          notes: portal?.notes ?? null,
          linked_contract_id: portal?.linked_contract_id ?? match?.id ?? null,
        } as WfPipelineTarget)
      : portal;

    const row = sheetDrivenRow({
      sheet,
      portal: portalFresh,
      contract: match,
      brandNames: match ? brandsByContract.get(match.id) ?? [] : [],
      salesReps,
    });
    if (targetId) row.target_id = targetId;
    newBusiness.push(row);
    coveredNew.add(normalizeCompanyKey(sheet.company_name));
  }

  // Portal-only rows Kate added that are not on the sheets yet
  for (const target of targets) {
    const key = normalizeCompanyKey(target.company_name);
    if (target.section === 'pending_renewal' && coveredPending.has(key)) continue;
    if (target.section === 'new_business' && coveredNew.has(key)) continue;
    // If sheets loaded successfully, only keep portal-only new_business adds (not stale pending seed)
    if (!sheetsError && target.section === 'pending_renewal') continue;

    const match = findMatchingContract(target.company_name, target.linked_contract_id, byId, contracts);
    if (isGraduatedOrConfirmed(target.company_name, match, confirmedContracts)) continue;

    const row: ParticipationReportRow = {
      id: target.id,
      section: target.section,
      company_name: target.company_name,
      sales_rep_id: target.sales_rep_id,
      sales_rep_name: target.sales_rep_name ?? null,
      sales_rep_initials: salesRepInitials(target.sales_rep_name, target.sales_rep_email),
      brands_text: target.brands_text ?? '',
      booth_count: target.booth_count,
      rate_per_booth_cents: target.rate_per_booth_cents,
      sponsorship_label: target.sponsorship_cents > 0 ? 'Y' : 'N',
      sponsorship_cents: target.sponsorship_cents,
      total_spend_cents: target.total_spend_cents,
      notes: target.notes ?? '',
      sheet_notes: '',
      pipeline_status: pipelineStatusLabel(match),
      contract_id: match?.id ?? target.linked_contract_id,
      contract_status: match?.status ?? null,
      target_id: target.id,
    };
    if (target.section === 'pending_renewal') pending.push(row);
    else newBusiness.push(row);
  }

  const sumBooths = (rows: ParticipationReportRow[]) => rows.reduce((a, r) => a + (r.booth_count || 0), 0);
  const sumSpend = (rows: ParticipationReportRow[]) => rows.reduce((a, r) => a + (r.total_spend_cents || 0), 0);

  const confirmedBooths = sumBooths(confirmed);
  const confirmedSpendCents = sumSpend(confirmed);
  const pendingBooths = sumBooths(pending);
  const pendingSpendCents = sumSpend(pending);

  return {
    event: { id: event.id, name: event.name, year: event.year },
    confirmed,
    pending,
    newBusiness,
    totals: {
      confirmedBooths,
      confirmedSpendCents,
      pendingBooths,
      pendingSpendCents,
      confirmedPlusPendingBooths: confirmedBooths + pendingBooths,
      confirmedPlusPendingSpendCents: confirmedSpendCents + pendingSpendCents,
    },
    salesReps,
    sheetsFetchedAt,
    sheetsError,
  };
}

export async function upsertPipelineTarget(
  input: {
    eventId: string;
    section: PipelineSection;
    companyName: string;
    salesRepId?: string | null;
    brandsText?: string | null;
    boothCount?: number;
    ratePerBoothCents?: number;
    sponsorshipCents?: number;
    totalSpendCents?: number;
    notes?: string | null;
    linkedContractId?: string | null;
  },
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<{ ok: true; row: WfPipelineTarget } | { ok: false; error: string }> {
  const company = input.companyName.trim();
  if (!company) return { ok: false, error: 'Company name is required' };

  const payload = {
    event_id: input.eventId,
    section: input.section,
    company_name: company,
    sales_rep_id: input.salesRepId ?? null,
    brands_text: input.brandsText?.trim() || null,
    booth_count: input.boothCount ?? 0,
    rate_per_booth_cents: input.ratePerBoothCents ?? 0,
    sponsorship_cents: input.sponsorshipCents ?? 0,
    total_spend_cents: input.totalSpendCents ?? 0,
    notes: input.notes?.trim() || null,
    linked_contract_id: input.linkedContractId ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('wf_pipeline_targets')
    .select('id')
    .eq('event_id', input.eventId)
    .eq('section', input.section)
    .ilike('company_name', company)
    .eq('is_active', true)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('wf_pipeline_targets')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, row: data as WfPipelineTarget };
  }

  const { data, error } = await supabase.from('wf_pipeline_targets').insert(payload).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as WfPipelineTarget };
}

export async function updatePipelineTarget(
  id: string,
  patch: Partial<{
    company_name: string;
    sales_rep_id: string | null;
    brands_text: string | null;
    booth_count: number;
    rate_per_booth_cents: number;
    sponsorship_cents: number;
    total_spend_cents: number;
    notes: string | null;
    linked_contract_id: string | null;
    is_active: boolean;
    section: PipelineSection;
  }>,
  supabase: SupabaseClient = getSupabaseAdmin(),
): Promise<{ ok: true; row: WfPipelineTarget } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('wf_pipeline_targets')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as WfPipelineTarget };
}
