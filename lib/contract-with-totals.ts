import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contract, ContractWithTotals } from '@/types/db';

/**
 * Columns on `contracts` that may be missing from `contracts_with_totals` until the view
 * is recreated after a migration (Postgres does not expand `c.*` automatically).
 * Overlay these from the base table when reading the view.
 */
const CONTRACT_COLUMNS_OVERLAY = [
  'billing_contact_name',
  'billing_contact_email',
  'event_contact_name',
  'event_contact_email',
  'exhibitor_fields_captured_at',
  'imported_at',
  'imported_by',
  'originally_signed_at',
  'exhibitor_notes',
  'order_type',
  'signer_cc_name',
  'signer_cc_email',
] as const satisfies readonly (keyof Contract)[];

type ContractOverlay = Pick<Contract, (typeof CONTRACT_COLUMNS_OVERLAY)[number]>;

export async function overlayContractColumnsFromBaseTable(
  supabase: SupabaseClient,
  contractId: string,
  row: ContractWithTotals,
): Promise<ContractWithTotals> {
  const { data: base } = await supabase
    .from('contracts')
    .select(CONTRACT_COLUMNS_OVERLAY.join(','))
    .eq('id', contractId)
    .maybeSingle<ContractOverlay>();

  if (!base) return row;
  return { ...row, ...base };
}

async function fetchContractWithTotalsFromBaseTable(
  supabase: SupabaseClient,
  contractId: string,
): Promise<ContractWithTotals | null> {
  const { data: base, error: baseErr } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .maybeSingle<Contract>();

  if (baseErr || !base) return null;

  const [{ data: lineItems }, { data: rep }] = await Promise.all([
    supabase.from('contract_line_items').select('amount_cents').eq('contract_id', contractId),
    base.sales_rep_id
      ? supabase.from('sales_reps').select('name, email').eq('id', base.sales_rep_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const lineSub = (lineItems ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0);
  const boothSub = base.booth_count * base.booth_rate_cents;
  const grand = boothSub + lineSub;

  return {
    ...base,
    booth_subtotal_cents: boothSub,
    additional_brand_fee_cents: 0,
    line_items_subtotal_cents: lineSub,
    total_amount_cents: grand,
    grand_total_cents: grand,
    sales_rep_name: rep?.name ?? null,
    sales_rep_email: rep?.email ?? null,
  };
}

export async function fetchContractWithTotalsById(
  supabase: SupabaseClient,
  contractId: string,
): Promise<ContractWithTotals | null> {
  const { data, error } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contractId)
    .maybeSingle<ContractWithTotals>();

  if (error) {
    console.error('[fetchContractWithTotalsById] view query failed', error);
  }

  if (data) {
    return overlayContractColumnsFromBaseTable(supabase, contractId, data);
  }

  return fetchContractWithTotalsFromBaseTable(supabase, contractId);
}
