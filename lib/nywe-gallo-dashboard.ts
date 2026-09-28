import { getSupabaseAdmin } from '@/lib/supabase';
import { PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import {
  contractQualifiesForGalloCombine,
  summarizeGalloForDashboard,
  type GalloDashboardSummary,
} from '@/lib/nywe-combined-contract';
import { isNyweVendorOnlyEvent, nyweLicenseFeeCents } from '@/lib/nywe-pricing';
import type { ContractWithTotals, Event } from '@/types/db';

export type GalloDashboardPayload = {
  eventId: string;
  feeCents: number;
  summary: GalloDashboardSummary;
};

function galloCountForEvent(contracts: ContractWithTotals[], eventId: string): number {
  return contracts.filter((contract) => contract.event_id === eventId).length;
}

/** Load Gallo licenses from the DB so the dashboard card does not depend on the page contract list. */
export async function loadGalloDashboardSummary(preferredEventId?: string | null): Promise<GalloDashboardPayload | null> {
  const supabase = getSupabaseAdmin();
  const { data: eventsData } = await supabase
    .from('events')
    .select('*')
    .eq('product_key', PRODUCT_WINE_SPECTATOR)
    .order('is_active', { ascending: false })
    .order('event_date', { ascending: false });
  const events = ((eventsData ?? []) as Event[]).filter((event) => isNyweVendorOnlyEvent(event));
  if (events.length === 0) return null;

  const eventIds = events.map((event) => event.id);
  const { data: contractsData } = await supabase
    .from('contracts_with_totals')
    .select(
      'id, event_id, status, sent_at, docusign_envelope_id, exhibitor_company_name, exhibitor_legal_name, booth_count, booth_rate_cents, grand_total_cents, covered_wineries, brands_poured, signer_1_email',
    )
    .in('event_id', eventIds)
    .neq('status', 'cancelled')
    .neq('status', 'voided')
    .limit(1000);

  const contracts = ((contractsData ?? []) as ContractWithTotals[]).filter((contract) =>
    contractQualifiesForGalloCombine(contract),
  );
  if (contracts.length === 0) return null;

  const preferred =
    (preferredEventId ? events.find((event) => event.id === preferredEventId) : null) ??
    [...events].sort((a, b) => galloCountForEvent(contracts, b.id) - galloCountForEvent(contracts, a.id))[0] ??
    events.find((event) => event.is_active) ??
    events[0]!;

  const feeCents = nyweLicenseFeeCents(preferred);
  // Summarize across every NYWE event so Louis M. Martini is not dropped when it lives on another row/event.
  const summary = summarizeGalloForDashboard(contracts, null, feeCents);
  if (!summary) return null;

  const eventId =
    contracts.find((contract) => contract.event_id === preferred.id)?.event_id ??
    contracts[0]?.event_id ??
    preferred.id;

  return { eventId, feeCents, summary };
}
