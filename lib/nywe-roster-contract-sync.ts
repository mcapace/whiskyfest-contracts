import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildContractPayloadFromRosterRow,
  rosterRowKey,
  type ExhibitorRosterRow,
} from '@/lib/exhibitor-roster';
import { resolveContractStreetFromSheetCells } from '@/lib/exhibitor-roster-billing';
import { formatRosterWineDisplay } from '@/lib/exhibitor-roster-columns';
import { eventTemplateProfile } from '@/lib/contract-template-profile';
import {
  normalizeSheetContractId,
  rosterRowMatchesContract,
  sheetRowBelongsToContract,
} from '@/lib/nywe-roster-identity';
import { rosterWineryWebsiteUrl } from '@/lib/winery-website';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/sheets-tracker';
import type { ContractStatus, ContractWithTotals, Event } from '@/types/db';

/**
 * Once an envelope is out (or finished), DocuSign owns signer identity.
 * Roster/sheet edits must not overwrite portal signer while status is `sent` —
 * that made Torbreck look like Andrew while reminders still went to Mary.
 * Use Resend with Changes to void and send a new envelope to the new signer.
 */
const SIGNER_LOCKED_STATUSES: ContractStatus[] = [
  'sent',
  'partially_signed',
  'signed',
  'executed',
];

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function rosterListKeyFromTab(tab: string): string {
  return tab.toLowerCase().includes('new') ? 'new' : 'returning';
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function patchChanged(
  contract: ContractWithTotals,
  patch: Record<string, string | null | boolean>,
): boolean {
  for (const [key, value] of Object.entries(patch)) {
    const current = contract[key as keyof ContractWithTotals];
    const left = normalize(typeof current === 'string' ? current : current == null ? '' : String(current));
    const right = normalize(typeof value === 'string' ? value : value == null ? '' : String(value));
    if (left !== right) return true;
  }
  return false;
}

export function contractPatchFromExhibitorRosterRow(
  row: ExhibitorRosterRow,
  contract: Pick<ContractWithTotals, 'id' | 'status' | 'exhibitor_company_name' | 'exhibitor_legal_name'>,
): Record<string, string | null | boolean> | null {
  const winery = row.wineryName.trim();
  const billingCompany = row.billingCompany.trim() || winery;
  if (!winery && !billingCompany) return null;

  // Prefer CONTRACT ID; names are a safety check when the ID cell is empty.
  if (!sheetRowBelongsToContract(row, contract as { id: string; exhibitor_company_name?: string | null; exhibitor_legal_name?: string | null })) {
    console.warn('[nywe-roster] skip patch — sheet row does not belong to this contract', {
      status: contract.status,
      contractCompany: contract.exhibitor_company_name,
      sheetWinery: row.wineryName,
    });
    return null;
  }

  const patch: Record<string, string | null | boolean> = {
    brands_poured: formatRosterWineDisplay(row.wineName, row.vintage) || null,
    billing_contact_name: row.billingContactName.trim() || null,
    billing_contact_email: row.billingEmail.trim() || null,
  };

  // Once an envelope is out, the signed document fixes who the licensee is. A re-sorted sheet
  // once rewrote hundreds of executed contracts to other wineries' names; never again.
  if (!SIGNER_LOCKED_STATUSES.includes(contract.status)) {
    patch.exhibitor_legal_name = billingCompany;
    patch.exhibitor_company_name = winery || billingCompany;
  }

  const website = rosterWineryWebsiteUrl(row);
  if (website) {
    patch.exhibitor_website_url = website;
  }

  const resolved = resolveContractStreetFromSheetCells(row.billingStreet, row.wineryAddress);
  if (resolved) {
    patch.billing_address_line1 = resolved.line1;
    patch.billing_address_line2 = null;
    patch.billing_city = row.billingCity.trim() || null;
    patch.billing_state = row.billingState.trim() || null;
    patch.billing_zip = row.billingZip.trim() || null;
    patch.billing_country = row.billingCountry.trim() || null;
    patch.billing_same_as_corporate = resolved.usedWineryStreet;
  }

  // Spreadsheet is the identity source. Signer stays locked once a DocuSign envelope is out.
  if (!SIGNER_LOCKED_STATUSES.includes(contract.status)) {
    patch.signer_1_name = row.signerName.trim() || null;
    patch.signer_1_email = row.signerEmail.trim() || null;
    patch.event_contact_name = row.primaryContactName.trim() || null;
    patch.event_contact_email = row.primaryContactEmail.trim() || null;
  } else {
    patch.event_contact_name = row.primaryContactName.trim() || null;
    patch.event_contact_email = row.primaryContactEmail.trim() || null;
  }

  return patch;
}

async function loadRosterPayloadForContract(
  contract: Pick<ContractWithTotals, 'source_sheet_id' | 'source_sheet_tab' | 'source_row_number'>,
  event: Event,
) {
  if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) return null;

  const sheets = getSheetsClient();
  const tab = contract.source_sheet_tab;
  const rowNumber = contract.source_row_number;
  const listKey = rosterListKeyFromTab(tab);

  const [headerRes, rowRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: contract.source_sheet_id,
      range: tabRange(tab, 'A1:AZ1'),
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: contract.source_sheet_id,
      range: tabRange(tab, `A${rowNumber}:AZ${rowNumber}`),
      valueRenderOption: 'FORMATTED_VALUE',
    }),
  ]);

  const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map((h) => String(h ?? '').trim());
  const row = ((rowRes.data.values?.[0] ?? []) as string[]).map((v) => String(v ?? '').trim());
  return buildContractPayloadFromRosterRow(row, listKey, event, headers);
}

function patchFromPayload(
  contract: ContractWithTotals,
  payload: NonNullable<Awaited<ReturnType<typeof loadRosterPayloadForContract>>>,
): Record<string, string | null | boolean> | null {
  const company = normalize(payload.exhibitor_company_name);
  const legal = normalize(payload.exhibitor_legal_name);
  if (!company && !legal) return null;

  if (
    !rosterRowMatchesContract(
      { wineryName: payload.exhibitor_company_name, billingCompany: payload.exhibitor_legal_name },
      contract,
    )
  ) {
    console.warn('[nywe-roster] skip refresh — sheet row winery does not match contract', {
      id: contract.id,
      contractCompany: contract.exhibitor_company_name,
      sheetWinery: payload.exhibitor_company_name,
    });
    return null;
  }

  const patch: Record<string, string | null | boolean> = {
    brands_poured: payload.brands_poured,
  };
  // Names come from the signed document once an envelope is out (see contractPatchFromExhibitorRosterRow).
  if (!SIGNER_LOCKED_STATUSES.includes(contract.status)) {
    patch.exhibitor_legal_name = payload.exhibitor_legal_name;
    patch.exhibitor_company_name = payload.exhibitor_company_name;
  }

  if (payload.exhibitor_website_url) {
    patch.exhibitor_website_url = payload.exhibitor_website_url;
  }

  if (payload.billing) {
    Object.assign(patch, payload.billing);
  }

  patch.event_contact_name = payload.event_contact_name;
  patch.event_contact_email = payload.event_contact_email;

  if (!SIGNER_LOCKED_STATUSES.includes(contract.status)) {
    patch.signer_1_name = payload.signer_1_name;
    patch.signer_1_email = payload.signer_1_email;
  }

  return patch;
}

export type RosterContractRefreshResult = {
  updated: boolean;
  skipped?: string;
  contract: ContractWithTotals;
};

/** Pull the linked Google Sheets row into the contract record (NYWE licenses). */
export async function refreshContractFromLinkedRoster(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  event: Event,
  options?: { revalidate?: boolean },
): Promise<RosterContractRefreshResult> {
  if (eventTemplateProfile(event) !== 'nywe_vendor') {
    return { updated: false, skipped: 'not_nywe', contract };
  }
  if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) {
    return { updated: false, skipped: 'no_source_row', contract };
  }

  const payload = await loadRosterPayloadForContract(contract, event);
  if (!payload) {
    return { updated: false, skipped: 'load_failed', contract };
  }

  const patch = patchFromPayload(contract, payload);
  if (!patch) {
    return { updated: false, skipped: 'missing_billing_address', contract };
  }

  if (!patchChanged(contract, patch)) {
    return { updated: false, skipped: 'unchanged', contract };
  }

  const { error } = await supabase.from('contracts').update(patch).eq('id', contract.id);
  if (error) {
    console.error('[refreshContractFromLinkedRoster]', contract.id, error.message);
    return { updated: false, skipped: error.message, contract };
  }

  const refreshed = { ...contract, ...patch } as ContractWithTotals;
  if (options?.revalidate !== false) {
    revalidateContractPaths(contract.id);
  }

  return { updated: true, contract: refreshed };
}

type LinkTarget = { contract: ContractWithTotals; row: ExhibitorRosterRow };

function contractRowKey(contract: ContractWithTotals): string | null {
  if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) return null;
  return rosterRowKey(contract.source_sheet_id, contract.source_sheet_tab, contract.source_row_number);
}

/**
 * Decide which sheet row each linked contract should point at.
 *
 * The sheet CONTRACT ID cell is the identity source: when the sheet is re-sorted, every row
 * number moves but the id travels with its row. A contract whose id appears nowhere may still
 * claim a row by winery name, but only a row no other contract claims and whose id cell is
 * empty (or names a contract that no longer exists). Everything else is left unassigned.
 */
export function assignRosterRowsToContracts(
  contracts: ContractWithTotals[],
  rows: ExhibitorRosterRow[],
): {
  targets: Map<string, ExhibitorRosterRow>;
  claimedBy: Map<string, string>;
  ambiguous: string[];
} {
  const contractById = new Map(contracts.map((c) => [c.id.toLowerCase(), c]));
  const rowsByContractId = new Map<string, ExhibitorRosterRow[]>();
  for (const row of rows) {
    const id = normalizeSheetContractId(row.sheetContractId);
    if (!id) continue;
    const list = rowsByContractId.get(id) ?? [];
    list.push(row);
    rowsByContractId.set(id, list);
  }

  const targets = new Map<string, ExhibitorRosterRow>();
  const claimedBy = new Map<string, string>();
  const ambiguous: string[] = [];

  // 1. Rows that carry the contract's id. If the id was written into several rows, keep the
  //    current link when it is one of them; otherwise take the first.
  for (const contract of contracts) {
    const candidates = (rowsByContractId.get(contract.id.toLowerCase()) ?? []).filter(
      (row) => !claimedBy.has(row.rowKey),
    );
    if (candidates.length === 0) continue;
    const currentKey = contractRowKey(contract);
    const pick = candidates.find((row) => row.rowKey === currentKey) ?? candidates[0]!;
    targets.set(contract.id, pick);
    claimedBy.set(pick.rowKey, contract.id);
  }

  // 2. Contracts without an id row: keep the current row if it is still theirs, else find
  //    exactly one free row for this winery by name.
  const rowFree = (row: ExhibitorRosterRow) => {
    if (claimedBy.has(row.rowKey)) return false;
    const id = normalizeSheetContractId(row.sheetContractId);
    return !id || !contractById.has(id);
  };
  const rowByKey = new Map(rows.map((row) => [row.rowKey, row]));
  for (const contract of contracts) {
    if (targets.has(contract.id)) continue;
    const currentKey = contractRowKey(contract);
    const currentRow = currentKey ? rowByKey.get(currentKey) : undefined;
    if (currentRow && rowFree(currentRow) && sheetRowBelongsToContract(currentRow, contract)) {
      targets.set(contract.id, currentRow);
      claimedBy.set(currentRow.rowKey, contract.id);
      continue;
    }
    const byName = rows.filter((row) => rowFree(row) && rosterRowMatchesContract(row, contract));
    if (byName.length === 1) {
      const row = byName[0]!;
      targets.set(contract.id, row);
      claimedBy.set(row.rowKey, contract.id);
    } else if (byName.length > 1) {
      ambiguous.push(contract.id);
    }
  }

  return { targets, claimedBy, ambiguous };
}

/**
 * Apply freshly fetched roster rows to linked contracts (no extra Sheets API calls).
 *
 * Re-links contracts whose row number no longer matches the row carrying their id, and
 * releases links that point at another winery's row. Moves are applied in two phases
 * (clear every moving row number, then set the new ones) because `contracts_source_sheet_row_uidx`
 * forbids two contracts on one row and after a sheet sort nearly every contract moves at once.
 */
export async function syncLinkedContractsFromRosterRows(
  eventId: string,
  rows: ExhibitorRosterRow[],
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: contractRows, error: loadError } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', eventId)
    .not('source_sheet_id', 'is', null);
  if (loadError) {
    console.error('[syncLinkedContractsFromRosterRows] contract lookup failed', loadError.message);
    return 0;
  }

  const contracts = (contractRows ?? []) as ContractWithTotals[];
  const rowByKey = new Map(rows.map((row) => [row.rowKey, row]));
  const { targets, claimedBy, ambiguous } = assignRosterRowsToContracts(contracts, rows);

  const moves: LinkTarget[] = [];
  const stays: LinkTarget[] = [];
  const releases: ContractWithTotals[] = [];

  for (const contract of contracts) {
    const currentKey = contractRowKey(contract);
    const target = targets.get(contract.id);
    if (target) {
      if (target.rowKey === currentKey) stays.push({ contract, row: target });
      else moves.push({ contract, row: target });
      continue;
    }
    if (!currentKey) continue;
    const currentRow = rowByKey.get(currentKey);
    const heldByOther = claimedBy.has(currentKey) && claimedBy.get(currentKey) !== contract.id;
    const foreignRow = Boolean(currentRow) && !sheetRowBelongsToContract(currentRow!, contract);
    if (heldByOther || foreignRow) releases.push(contract);
  }

  if (ambiguous.length > 0) {
    console.warn('[syncLinkedContractsFromRosterRows] several unclaimed rows match by name; left unlinked', ambiguous);
  }

  let updated = 0;
  const touched = new Set<string>();

  // Phase 1: free every row number that is changing so no intermediate state collides.
  const clearing = [...moves.map((m) => m.contract), ...releases];
  if (clearing.length > 0) {
    const { error } = await supabase
      .from('contracts')
      .update({ source_row_number: null })
      .in('id', clearing.map((c) => c.id));
    if (error) {
      console.error('[syncLinkedContractsFromRosterRows] could not clear moving rows', error.message);
      return 0;
    }
    for (const c of releases) {
      console.warn('[syncLinkedContractsFromRosterRows] released stale sheet row', {
        id: c.id,
        company: c.exhibitor_company_name,
        row: c.source_row_number,
      });
      touched.add(c.id);
    }
  }

  // Phase 2: point moved contracts at their rows and apply row data to every linked contract.
  for (const { contract, row } of [...moves, ...stays]) {
    const moving = row.rowKey !== contractRowKey(contract);
    const patch = contractPatchFromExhibitorRosterRow(row, contract);
    const changed = patch ? patchChanged(contract, patch) : false;
    if (!moving && !changed) continue;

    const update: Record<string, string | number | boolean | null> = {
      ...(changed ? patch : {}),
      ...(moving
        ? {
            source_sheet_id: row.spreadsheetId,
            source_sheet_tab: row.tab,
            source_row_number: row.rowNumber,
          }
        : {}),
    };

    const { error } = await supabase.from('contracts').update(update).eq('id', contract.id);
    if (error) {
      console.error('[syncLinkedContractsFromRosterRows]', contract.id, error.message);
      continue;
    }
    updated += 1;
    touched.add(contract.id);
  }

  if (moves.length > 0 || releases.length > 0) {
    console.info('[syncLinkedContractsFromRosterRows] relinked', {
      moved: moves.length,
      released: releases.length,
      unchanged: stays.length,
    });
  }
  for (const id of touched) revalidateContractPaths(id);

  return updated;
}
