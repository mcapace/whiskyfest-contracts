import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { writeExhibitorRosterStatusForContract } from '@/lib/exhibitor-roster-writeback';
import { isNyweVendorOnlyEvent, nyweLicenseFeeCents } from '@/lib/nywe-pricing';
import {
  applyRosterRowsToCombinedContract,
  canMergeNyweContract,
  contractQualifiesForGalloCombine,
  coveredWineryKey,
  coveredWinerySourceKeys,
  galloContractFieldsFromWineries,
  NYWE_GALLO_CONTRACT_NAME,
  primarySourceRow,
  wineriesFromContract,
  type CombinedRosterWineryInput,
  type NyweCoveredWinery,
} from '@/lib/nywe-combined-contract';
import type { NyweBillingFields } from '@/lib/nywe-billing';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

const CLOSED_STATUSES = new Set(['cancelled', 'voided']);

export type CombineGalloContractsResult = {
  contractId: string | null;
  cancelledIds: string[];
  wineryCount: number;
  coveredRowKeys: string[];
  skippedLockedWineries: string[];
};

function wineryNamesOnLockedContracts(contracts: Contract[]): Set<string> {
  const names = new Set<string>();
  for (const contract of contracts) {
    if (canMergeNyweContract(contract)) continue;
    for (const winery of wineriesFromContract(contract)) {
      names.add(coveredWineryKey(winery.winery_name));
    }
  }
  return names;
}

function withoutLockedWineries(wineries: NyweCoveredWinery[], locked: Set<string>): NyweCoveredWinery[] {
  return wineries.filter((winery) => !locked.has(coveredWineryKey(winery.winery_name)));
}

/**
 * Fold unsent NYWE Gallo contracts for one event into a single license.
 * The total is the license fee times the number of distinct wineries.
 * Contracts already sent for signature stay separate so a signed PDF is not rewritten.
 */
export async function combineGalloContractsForEvent(options: {
  supabase: SupabaseClient;
  event: Pick<Event, 'id' | 'booth_rate_cents' | 'contract_template_profile'>;
  actorEmail: string;
  preferContractId?: string | null;
  additionalWineries?: NyweCoveredWinery[];
  additionalRosterRows?: CombinedRosterWineryInput[];
  seed?: {
    signer_1_name?: string | null;
    signer_1_email?: string | null;
    event_contact_name?: string | null;
    event_contact_email?: string | null;
    billing?: NyweBillingFields | null;
  };
}): Promise<CombineGalloContractsResult> {
  const empty: CombineGalloContractsResult = {
    contractId: null,
    cancelledIds: [],
    wineryCount: 0,
    coveredRowKeys: [],
    skippedLockedWineries: [],
  };
  if (!isNyweVendorOnlyEvent(options.event)) return empty;

  const { data, error } = await options.supabase
    .from('contracts')
    .select('*')
    .eq('event_id', options.event.id);
  if (error) {
    console.error('[combineGalloContractsForEvent]', error.message);
    return empty;
  }

  const contracts = ((data ?? []) as Contract[]).filter(
    (contract) => !CLOSED_STATUSES.has(contract.status) && contractQualifiesForGalloCombine(contract),
  );
  const locked = wineryNamesOnLockedContracts(contracts);
  const mergeable = contracts.filter((contract) => canMergeNyweContract(contract));
  const skippedLockedWineries = (options.additionalWineries ?? [])
    .filter((winery) => locked.has(coveredWineryKey(winery.winery_name)))
    .map((winery) => winery.winery_name);

  let wineries = withoutLockedWineries(
    [
      ...mergeable.flatMap((contract) => wineriesFromContract(contract)),
      ...(options.additionalWineries ?? []),
    ],
    locked,
  );
  wineries = applyRosterRowsToCombinedContract(wineries, options.additionalRosterRows ?? [], { locked: false });
  wineries = withoutLockedWineries(wineries, locked);

  if (wineries.length === 0) return { ...empty, skippedLockedWineries };

  const nothingNew =
    (options.additionalWineries ?? []).length === 0 && (options.additionalRosterRows ?? []).length === 0;
  if (mergeable.length === 1 && nothingNew) {
    const only = mergeable[0]!;
    const existing = wineriesFromContract(only);
    const sameNames =
      existing.length === wineries.length &&
      existing.every(
        (winery, index) =>
          coveredWineryKey(winery.winery_name) === coveredWineryKey(wineries[index]?.winery_name ?? ''),
      );
    const priced =
      only.booth_count === Math.max(1, existing.length) &&
      (existing.length <= 1 || only.exhibitor_company_name === NYWE_GALLO_CONTRACT_NAME);
    if (sameNames && priced) {
      return {
        contractId: only.id,
        cancelledIds: [],
        wineryCount: Math.max(1, existing.length),
        coveredRowKeys: coveredWinerySourceKeys(existing),
        skippedLockedWineries,
      };
    }
  }

  const feeCents = nyweLicenseFeeCents(options.event);
  const preferred = options.preferContractId
    ? mergeable.find((contract) => contract.id === options.preferContractId)
    : null;
  const survivor =
    preferred ??
    [...mergeable].sort((a, b) => {
      const score = wineriesFromContract(b).length - wineriesFromContract(a).length;
      if (score !== 0) return score;
      return a.created_at.localeCompare(b.created_at);
    })[0] ??
    null;

  const legalName = survivor?.exhibitor_legal_name?.trim() || 'GALLO';
  const companyName = survivor?.exhibitor_company_name?.trim() || 'Gallo';
  const fields = galloContractFieldsFromWineries({
    legalName,
    companyName,
    wineries,
    feeCents,
  });
  const source = primarySourceRow(fields.covered_wineries ?? []);
  const website =
    fields.covered_wineries?.find((winery) => winery.website_url)?.website_url ??
    survivor?.exhibitor_website_url ??
    null;

  let contractId = survivor?.id ?? null;
  if (!survivor) {
    const { data: inserted, error: insertError } = await options.supabase
      .from('contracts')
      .insert({
        event_id: options.event.id,
        status: 'draft',
        exhibitor_legal_name: fields.exhibitor_legal_name,
        exhibitor_company_name: fields.exhibitor_company_name,
        brands_poured: fields.brands_poured,
        covered_wineries: fields.covered_wineries,
        order_type: 'booth',
        booth_count: fields.booth_count,
        booth_rate_cents: fields.booth_rate_cents,
        exhibitor_website_url: website,
        source_sheet_id: source?.source_sheet_id ?? null,
        source_sheet_tab: source?.source_sheet_tab ?? null,
        source_row_number: source?.source_row_number ?? null,
        created_by: options.actorEmail,
        signer_1_name: options.seed?.signer_1_name ?? null,
        signer_1_email: options.seed?.signer_1_email ?? null,
        event_contact_name: options.seed?.event_contact_name ?? null,
        event_contact_email: options.seed?.event_contact_email ?? null,
        ...(options.seed?.billing ?? {}),
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      console.error('[combineGalloContractsForEvent] insert', insertError?.message);
      return { ...empty, skippedLockedWineries };
    }
    contractId = inserted.id as string;
    await options.supabase.from('audit_log').insert({
      contract_id: contractId,
      actor_email: options.actorEmail,
      action: 'nywe_gallo_contracts_combined',
      to_status: 'draft',
      metadata: {
        winery_count: fields.booth_count,
        wineries: (fields.covered_wineries ?? []).map((winery) => winery.winery_name),
        total_cents: fields.booth_count * fields.booth_rate_cents,
      },
    });
  } else {
    const { error: updateError } = await options.supabase
      .from('contracts')
      .update({
        exhibitor_legal_name: fields.exhibitor_legal_name,
        exhibitor_company_name: fields.exhibitor_company_name,
        brands_poured: fields.brands_poured,
        covered_wineries: fields.covered_wineries,
        booth_count: fields.booth_count,
        booth_rate_cents: fields.booth_rate_cents,
        exhibitor_website_url: website,
        source_sheet_id: source?.source_sheet_id ?? survivor.source_sheet_id,
        source_sheet_tab: source?.source_sheet_tab ?? survivor.source_sheet_tab,
        source_row_number: source?.source_row_number ?? survivor.source_row_number,
        ...(!survivor.signer_1_email && options.seed?.signer_1_email
          ? {
              signer_1_name: options.seed.signer_1_name ?? null,
              signer_1_email: options.seed.signer_1_email,
            }
          : {}),
        ...(!survivor.event_contact_email && options.seed?.event_contact_email
          ? {
              event_contact_name: options.seed.event_contact_name ?? null,
              event_contact_email: options.seed.event_contact_email,
            }
          : {}),
      })
      .eq('id', survivor.id);
    if (updateError) {
      console.error('[combineGalloContractsForEvent] update', updateError.message);
      return { ...empty, skippedLockedWineries };
    }
    await options.supabase.from('audit_log').insert({
      contract_id: survivor.id,
      actor_email: options.actorEmail,
      action: 'nywe_gallo_contracts_combined',
      metadata: {
        winery_count: fields.booth_count,
        wineries: (fields.covered_wineries ?? []).map((winery) => winery.winery_name),
        total_cents: fields.booth_count * fields.booth_rate_cents,
      },
    });
  }

  const cancelledIds: string[] = [];
  for (const other of mergeable) {
    if (!contractId || other.id === contractId) continue;
    const reason = `Combined into the Gallo contract ${contractId}`;
    const { error: cancelError } = await options.supabase
      .from('contracts')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: options.actorEmail,
        cancelled_reason: reason,
        source_sheet_id: null,
        source_sheet_tab: null,
        source_row_number: null,
        covered_wineries: null,
      })
      .eq('id', other.id);
    if (cancelError) {
      console.error('[combineGalloContractsForEvent] cancel', other.id, cancelError.message);
      continue;
    }
    cancelledIds.push(other.id);
    await options.supabase.from('audit_log').insert({
      contract_id: other.id,
      actor_email: options.actorEmail,
      action: 'cancelled',
      from_status: other.status,
      to_status: 'cancelled',
      metadata: { reason, combined_into: contractId },
    });
    revalidateContractPaths(other.id);
  }

  if (contractId) {
    revalidateContractPaths(contractId);
    const { data: withTotals } = await options.supabase
      .from('contracts_with_totals')
      .select('*')
      .eq('id', contractId)
      .maybeSingle<ContractWithTotals>();
    if (withTotals) {
      try {
        await writeExhibitorRosterStatusForContract(withTotals);
      } catch (err) {
        console.error(
          '[combineGalloContractsForEvent] roster writeback',
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return {
    contractId,
    cancelledIds,
    wineryCount: fields.booth_count,
    coveredRowKeys: coveredWinerySourceKeys(fields.covered_wineries ?? []),
    skippedLockedWineries,
  };
}
