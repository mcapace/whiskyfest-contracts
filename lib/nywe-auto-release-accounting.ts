import type { SupabaseClient } from '@supabase/supabase-js';
import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { NYWE_COUNTERSIGNER_EMAILS } from '@/lib/nywe-countersigner';
import { releaseContractToAccounting } from '@/lib/release-to-accounting';
import type { ContractWithTotals, Event } from '@/types/db';

export { NYWE_COUNTERSIGNER_EMAILS } from '@/lib/nywe-countersigner';

export function nyweCountersignerCompleted(
  contract: Pick<ContractWithTotals, 'countersigned_by_email'>,
  event: Pick<Event, 'shanken_signatory_email'>,
): boolean {
  const actual = contract.countersigned_by_email?.trim().toLowerCase();
  if (!actual) return false;
  const expected = event.shanken_signatory_email?.trim().toLowerCase();
  if (expected && actual === expected) return true;
  return NYWE_COUNTERSIGNER_EMAILS.has(actual);
}

/** NYWE license fully countersigned in DocuSign but not yet handed to accounting. */
export function nyweNeedsAutoReleaseToAccounting(
  contract: Pick<ContractWithTotals, 'status' | 'executed_at' | 'accounting_notified_at'>,
  event: Pick<Event, 'product_key' | 'workflow_profile'> | null | undefined,
): boolean {
  if (!event || !isNyweEventsManagedEvent(event)) return false;
  if (contract.status !== 'signed') return false;
  if (contract.executed_at || contract.accounting_notified_at) return false;
  return true;
}

/**
 * After Susannah countersigns, email accounting and mark executed.
 * Safe to call repeatedly — no-ops when already executed.
 */
export async function autoReleaseNyweToAccounting(options: {
  supabase: SupabaseClient;
  contract: ContractWithTotals;
  event: Event;
  actorEmail: string;
  countersignerEmail?: string | null;
}): Promise<{ released: boolean; error?: string }> {
  const { supabase, contract, event, actorEmail } = options;

  if (!isNyweEventsManagedEvent(event)) {
    return { released: false, error: 'Not an NYWE events-managed license.' };
  }

  if (contract.status === 'executed') {
    return { released: false };
  }

  if (contract.status !== 'signed') {
    return { released: false, error: `Expected signed status, got ${contract.status}.` };
  }

  const countersignerEmail =
    options.countersignerEmail?.trim().toLowerCase() ||
    contract.countersigned_by_email?.trim().toLowerCase() ||
    event.shanken_signatory_email?.trim().toLowerCase() ||
    'nywe-auto@mshanken.com';

  const release = await releaseContractToAccounting({
    contract,
    event,
    actorEmail: countersignerEmail || actorEmail,
    auditAction: 'auto_released_to_accounting',
    supabase,
  });

  if (!release.ok) {
    console.error('[NYWE auto-release]', contract.id, release.error);
    return { released: false, error: release.error };
  }

  return { released: true };
}

/** Refresh contract row after signed PDF persist, then auto-release if eligible. */
export async function autoReleaseNyweAfterCountersign(options: {
  supabase: SupabaseClient;
  contractId: string;
  event: Event;
  countersignerEmail?: string | null;
  actorEmail?: string | null;
}): Promise<{ released: boolean; error?: string }> {
  const { data: contract } = await options.supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', options.contractId)
    .maybeSingle<ContractWithTotals>();

  if (!contract || !nyweNeedsAutoReleaseToAccounting(contract, options.event)) {
    return { released: false };
  }

  return autoReleaseNyweToAccounting({
    supabase: options.supabase,
    contract,
    event: options.event,
    actorEmail: options.actorEmail ?? options.countersignerEmail ?? 'nywe-auto@mshanken.com',
    countersignerEmail: options.countersignerEmail,
  });
}
