import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContractStatus } from '@/types/db';

export async function insertContractAudit(
  supabase: SupabaseClient,
  row: {
    contract_id: string;
    actor_email?: string | null;
    action: string;
    from_status?: ContractStatus | null;
    to_status?: ContractStatus | null;
    metadata?: Record<string, unknown> | null;
    impersonation_target_email?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    contract_id: row.contract_id,
    actor_email: row.actor_email ?? null,
    action: row.action,
    from_status: row.from_status ?? null,
    to_status: row.to_status ?? null,
    metadata: row.metadata ?? null,
    impersonation_target_email: row.impersonation_target_email ?? null,
  });
  if (error) {
    console.error('[audit_log] insert failed', row.action, row.contract_id, error);
  }
}
