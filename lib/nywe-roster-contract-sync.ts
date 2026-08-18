import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildContractPayloadFromRosterRow,
  rosterRowKey,
  type ExhibitorRosterRow,
} from '@/lib/exhibitor-roster';
import { resolveContractStreetFromSheetCells } from '@/lib/exhibitor-roster-billing';
import { formatRosterWineDisplay } from '@/lib/exhibitor-roster-columns';
import { eventTemplateProfile } from '@/lib/contract-template-profile';
import { normalizeSheetContractId, rosterRowMatchesContract, sheetRowBelongsToContract } from '@/lib/nywe-roster-identity';
import { normalizeWineryWebsiteUrl } from '@/lib/winery-website';
import { updateRebrandlyDestination } from '@/lib/rebrandly';
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
    exhibitor_legal_name: billingCompany,
    exhibitor_company_name: winery || billingCompany,
    brands_poured: formatRosterWineDisplay(row.wineName, row.vintage) || null,
    billing_contact_name: row.billingContactName.trim() || null,
    billing_contact_email: row.billingEmail.trim() || null,
  };

  const website = normalizeWineryWebsiteUrl(row.wineryWebsite);
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
    exhibitor_legal_name: payload.exhibitor_legal_name,
    exhibitor_company_name: payload.exhibitor_company_name,
    brands_poured: payload.brands_poured,
  };

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

/** Apply freshly fetched roster rows to linked contracts (no extra Sheets API calls). */
export async function syncLinkedContractsFromRosterRows(
  eventId: string,
  rows: ExhibitorRosterRow[],
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: contracts } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('event_id', eventId)
    .not('source_sheet_id', 'is', null);

  const rowByKey = new Map(rows.map((row) => [row.rowKey, row]));
  const rowByContractId = new Map<string, ExhibitorRosterRow>();
  for (const row of rows) {
    const id = normalizeSheetContractId(row.sheetContractId);
    if (id) rowByContractId.set(id, row);
  }

  let updated = 0;

  for (const contract of (contracts ?? []) as ContractWithTotals[]) {
    const byId = rowByContractId.get(contract.id.toLowerCase()) ?? null;
    const byRow =
      contract.source_sheet_id && contract.source_sheet_tab && contract.source_row_number
        ? rowByKey.get(
            rosterRowKey(contract.source_sheet_id, contract.source_sheet_tab, contract.source_row_number),
          ) ?? null
        : null;

    const row = byId ?? (byRow && sheetRowBelongsToContract(byRow, contract) ? byRow : null);
    if (!row) continue;

    const rowMoved =
      Boolean(byId) &&
      (contract.source_row_number !== row.rowNumber ||
        contract.source_sheet_tab !== row.tab ||
        contract.source_sheet_id !== row.spreadsheetId);

    const patch = contractPatchFromExhibitorRosterRow(row, contract);
    const needsRelink = rowMoved;
    if ((!patch || !patchChanged(contract, patch)) && !needsRelink) continue;

    const update: Record<string, string | number | boolean | null> = {
      ...(patch ?? {}),
      ...(needsRelink
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
    const nextWebsite =
      typeof update.exhibitor_website_url === 'string' ? update.exhibitor_website_url : null;
    if (contract.rebrandly_link_id && nextWebsite && nextWebsite !== contract.exhibitor_website_url) {
      try {
        await updateRebrandlyDestination(contract.rebrandly_link_id, nextWebsite);
      } catch (err) {
        console.warn(
          '[syncLinkedContractsFromRosterRows] Rebrandly destination update failed',
          contract.id,
          err instanceof Error ? err.message : err,
        );
      }
    }
    updated += 1;
    revalidateContractPaths(contract.id);
  }

  return updated;
}
