import { contractPrefersSignedPdf } from '@/lib/contract-pdf-preview';
import { fetchContractBoothBrandsOrdered } from '@/lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import { contractPdfBaseName } from '@/lib/contract-document-naming';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { contractUsesOrderTable } from '@/lib/contract-template-profile';
import { isNyweVendorEvent } from '@/lib/nywe-pricing';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { buildContractMergeMap } from '@/lib/merge-map';
import { refreshNyweBillingFromRosterForContract } from '@/lib/nywe-roster-billing-sync';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import type { Contract, ContractStatus, Event } from '@/types/db';
import type { SupabaseClient } from '@supabase/supabase-js';

const LIVE_PREVIEW_STATUSES = new Set<ContractStatus>([
  'draft',
  'ready_for_review',
  'pending_events_review',
  'approved',
]);

/** NYWE draft preview always merges fresh from the template (not a stale stored PDF). */
export function nyweUsesLiveDraftPreview(
  contract: Pick<Contract, 'status'>,
  event: Pick<Event, 'contract_template_profile'> | null,
  variant: string,
): boolean {
  if (!event || !isNyweVendorEvent(event)) return false;
  if (variant === 'signed') return false;
  if (variant === 'auto' && contractPrefersSignedPdf(contract.status)) return false;
  return LIVE_PREVIEW_STATUSES.has(contract.status);
}

export async function renderNyweLiveDraftPdf(
  supabase: SupabaseClient,
  contractId: string,
): Promise<Buffer | null> {
  let contract = await fetchContractWithTotalsById(supabase, contractId);
  if (!contract) return null;

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event || !isNyweVendorEvent(event)) return null;

  contract = await refreshNyweBillingFromRosterForContract(supabase, contract, event);
  const [boothBrands, lineItems] = await Promise.all([
    fetchContractBoothBrandsOrdered(supabase, contract.id),
    fetchContractLineItemsOrdered(supabase, contract.id),
  ]);
  const mergeMap = buildContractMergeMap(contract, event, 'draft', boothBrands);
  const templateDocId = resolveContractTemplateDocId(contract, event);
  const fileName = contractPdfBaseName(contract.exhibitor_company_name, event);
  const usesOrderTable = contractUsesOrderTable(event, contract);

  return renderContractPdfFromTemplate(
    templateDocId,
    mergeMap,
    fileName,
    usesOrderTable ? lineItems : undefined,
    {
      includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract),
    },
  );
}
