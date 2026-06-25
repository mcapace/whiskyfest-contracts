import { getSupabaseAdmin } from '@/lib/supabase';
import { requireContractActorForPage } from '@/lib/auth-contract';
import { getVisibleContractsFilter } from '@/lib/permissions';
import { ContractsList } from '@/components/contracts/contracts-list';
import { fetchBoothBrandsByContractIds } from '@/lib/contract-booth-brand-queries';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { boothBrandRowsRecordFromMap } from '@/lib/sponsors';
import type { ContractWithTotals, ContractStatus, Event } from '@/types/db';
import {
  PRODUCT_WHISKYFEST,
  eventIdsForProduct,
  scopeContractsByProduct,
  scopeEventsByProduct,
  type ProductKey,
} from '@/lib/product-portal';

export const dynamic = 'force-dynamic';

const VALID: Set<string> = new Set([
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
]);

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
}

function isContractVisibleToActor(
  row: Pick<ContractWithTotals, 'sales_rep_id'>,
  visibility: ReturnType<typeof getVisibleContractsFilter>,
): boolean {
  if (visibility.filter !== 'own') return true;
  if (visibility.salesRepIds.length === 0) return false;
  if (!row.sales_rep_id) return false;
  return visibility.salesRepIds.includes(row.sales_rep_id);
}

export async function loadContracts(
  actor: Awaited<ReturnType<typeof requireContractActorForPage>>,
  searchParams: { status?: string; q?: string; importedId?: string },
  productKey: ProductKey = PRODUCT_WHISKYFEST,
) {
  const supabase = getSupabaseAdmin();

  const { data: events } = await supabase.from('events').select('*');
  const allEvents = (events ?? []) as Event[];
  const productEventIds = eventIdsForProduct(allEvents, productKey);

  let query = supabase.from('contracts_with_totals').select('*').order('created_at', { ascending: false }).limit(200);

  if (productEventIds.length === 0) {
    query = query.limit(0);
  } else {
    query = query.in('event_id', productEventIds);
  }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('is_accounting, can_view_all_sales')
    .eq('email', actor.email)
    .maybeSingle();
  const visibility = getVisibleContractsFilter({
    role: actor.role,
    is_events_team: actor.isEventsTeam,
    is_accounting: Boolean((appUser as { is_accounting?: boolean } | null)?.is_accounting),
    can_view_all_sales: Boolean((appUser as { can_view_all_sales?: boolean } | null)?.can_view_all_sales),
    accessibleSalesRepIds: actor.accessibleSalesRepIds,
  });
  if (visibility.filter === 'own' && visibility.salesRepIds.length > 0) {
    query = query.in('sales_rep_id', visibility.salesRepIds);
  } else if (visibility.filter === 'own') {
    query = query.limit(0);
  }

  const status = searchParams.status;
  if (status && status !== 'all') {
    if (status === 'draft') {
      query = query.or('status.eq.draft,status.eq.ready_for_review');
    } else if (VALID.has(status)) {
      query = query.eq('status', status as ContractStatus);
    }
  }

  const q = searchParams.q?.trim();
  let boothBrandContractIds: string[] = [];
  if (q) {
    const safe = escapeIlikePattern(q);
    const pattern = `%${safe}%`;
    const { data: boothRows } = await supabase.from('contract_booth_brands').select('contract_id').ilike('brand_name', pattern);
    boothBrandContractIds = [...new Set((boothRows ?? []).map((r) => r.contract_id as string))];
    const parts = [
      `exhibitor_company_name.ilike.${pattern}`,
      `brands_poured.ilike.${pattern}`,
      `signer_1_name.ilike.${pattern}`,
      `signer_1_email.ilike.${pattern}`,
    ];
    if (boothBrandContractIds.length > 0) {
      parts.push(`id.in.(${boothBrandContractIds.join(',')})`);
    }
    query = query.or(parts.join(','));
  }

  const [{ data: contracts }] = await Promise.all([query]);

  const scopedEvents = scopeEventsByProduct(allEvents, productKey);
  let contractRows = scopeContractsByProduct((contracts ?? []) as ContractWithTotals[], allEvents, productKey);

  const importedId = searchParams.importedId?.trim();
  if (importedId && !contractRows.some((c) => c.id === importedId)) {
    const importedRow = await fetchContractWithTotalsById(supabase, importedId);
    if (importedRow && isContractVisibleToActor(importedRow, visibility)) {
      const [scopedImported] = scopeContractsByProduct([importedRow], allEvents, productKey);
      if (scopedImported) {
        contractRows = [scopedImported, ...contractRows];
      }
    }
  }

  const contractIds = contractRows.map((c) => c.id);
  const boothBrandRows =
    contractIds.length > 0 ? await fetchBoothBrandsByContractIds(supabase, contractIds) : [];

  const boothMap = new Map<
    string,
    { brand_name: string; brand_category?: string | null; expressions?: string[] }[]
  >();
  for (const row of boothBrandRows) {
    const cid = (row as { contract_id: string }).contract_id;
    const name = ((row as { brand_name?: string }).brand_name ?? '').trim();
    if (!name) continue;
    const list = boothMap.get(cid) ?? [];
    list.push({
      brand_name: name,
      brand_category: (row as { brand_category?: string | null }).brand_category,
      expressions: (row as { expressions?: string[] }).expressions,
    });
    boothMap.set(cid, list);
  }

  return {
    contracts: contractRows,
    events: scopedEvents,
    boothRowsByContract: boothBrandRowsRecordFromMap(boothMap),
    portalBasePath: productKey === PRODUCT_WHISKYFEST ? '' : '/wine-spectator',
  };
}

export default async function ContractsListPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireContractActorForPage();
  const importedId = typeof searchParams.imported === 'string' ? searchParams.imported.trim() : undefined;
  const status =
    typeof searchParams.status === 'string'
      ? searchParams.status
      : importedId
        ? 'pending_events_review'
        : undefined;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;

  const { contracts, events, boothRowsByContract, portalBasePath } = await loadContracts(actor, {
    status,
    q,
    importedId,
  });
  const importedContract = importedId ? contracts.find((c) => c.id === importedId) : undefined;

  return (
    <ContractsList
      contracts={contracts}
      events={events}
      currentRepId={actor.salesRepId}
      boothRowsByContract={boothRowsByContract}
      portalBasePath={portalBasePath}
      importedContractId={importedId}
      importedExhibitorName={importedContract?.exhibitor_company_name ?? null}
      initialFilterStatus={status === 'pending_events_review' && importedId ? 'pending_events_review' : 'all'}
    />
  );
}
