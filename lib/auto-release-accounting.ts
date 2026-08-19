import type { SupabaseClient } from '@supabase/supabase-js';
import { insertContractAudit } from '@/lib/audit-log';
import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { autoReleaseNyweAfterCountersign } from '@/lib/nywe-auto-release-accounting';
import { isLegacyImportedContract } from '@/lib/legacy-import';
import { PRODUCT_BIG_SMOKE, PRODUCT_WHISKYFEST } from '@/lib/product-portal';
import { releaseContractToAccounting } from '@/lib/release-to-accounting';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import type { ContractWithTotals, Event } from '@/types/db';

/** WhiskyFest + Big Smoke + NYWE events-managed: signed contracts auto-release to accounting. */
export function eventAutoReleasesToAccounting(
  event: Pick<Event, 'product_key' | 'workflow_profile'> | null | undefined,
): boolean {
  if (!event) return false;
  return (
    isNyweEventsManagedEvent(event) ||
    event.product_key === PRODUCT_WHISKYFEST ||
    event.product_key === PRODUCT_BIG_SMOKE
  );
}

/** Fully signed (DocuSign or approved legacy import) but not yet handed to accounting. */
export function contractNeedsAutoReleaseToAccounting(
  contract: Pick<
    ContractWithTotals,
    'status' | 'executed_at' | 'accounting_notified_at' | 'imported_at' | 'events_approved_at'
  >,
): boolean {
  if (contract.status !== 'signed') return false;
  if (contract.executed_at || contract.accounting_notified_at) return false;
  // Legacy PDFs only auto-release after events approval (not while still under review).
  if (isLegacyImportedContract(contract as ContractWithTotals) && !contract.events_approved_at) {
    return false;
  }
  return true;
}

/** After both parties sign, email accounting and mark executed. */
export async function autoReleaseAfterFullySigned(options: {
  supabase: SupabaseClient;
  contractId: string;
  event: Event;
  countersignerEmail?: string | null;
  actorEmail?: string | null;
}): Promise<{ released: boolean; error?: string }> {
  const contract = await fetchContractWithTotalsById(options.supabase, options.contractId);
  if (!contract || !contractNeedsAutoReleaseToAccounting(contract)) {
    return { released: false };
  }

  if (isNyweEventsManagedEvent(options.event)) {
    return autoReleaseNyweAfterCountersign({
      supabase: options.supabase,
      contractId: options.contractId,
      event: options.event,
      countersignerEmail: options.countersignerEmail,
      actorEmail: options.actorEmail,
    });
  }

  const actorEmail =
    options.countersignerEmail?.trim().toLowerCase() ||
    options.actorEmail?.trim().toLowerCase() ||
    contract.countersigned_by_email?.trim().toLowerCase() ||
    'auto-release@mshanken.com';

  const release = await releaseContractToAccounting({
    contract,
    event: options.event,
    actorEmail,
    auditAction: 'auto_released_to_accounting',
    supabase: options.supabase,
  });

  if (!release.ok) {
    console.error('[auto-release]', contract.id, release.error);
    await insertContractAudit(options.supabase, {
      contract_id: contract.id,
      actor_email: actorEmail,
      action: 'auto_release_failed',
      metadata: { error: release.error },
    });
    return { released: false, error: release.error };
  }

  return { released: true };
}
