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

export async function fetchContractWithTotalsById(
  supabase: SupabaseClient,
  contractId: string,
): Promise<ContractWithTotals | null> {
  const { data, error } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contractId)
    .maybeSingle<ContractWithTotals>();

  if (error || !data) return null;
  return overlayContractColumnsFromBaseTable(supabase, contractId, data);
}
