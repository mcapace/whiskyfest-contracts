import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildContractPayloadFromRosterRow,
  rosterRowKey,
  type ExhibitorRosterRow,
} from '@/lib/exhibitor-roster';
import { resolveContractStreetFromSheetCells } from '@/lib/exhibitor-roster-billing';
import { formatRosterWineDisplay } from '@/lib/exhibitor-roster-columns';
import { eventTemplateProfile } from '@/lib/contract-template-profile';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSheetsClient } from '@/lib/sheets-tracker';
import type { ContractStatus, ContractWithTotals, Event } from '@/types/db';

/** After countersign / execution, DocuSign owns signer identity on the envelope. */
const SIGNER_LOCKED_STATUSES: ContractStatus[] = ['partially_signed', 'signed', 'executed'];

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
  contract: Pick<ContractWithTotals, 'status'>,
): Record<string, string | null | boolean> | null {
  const resolved = resolveContractStreetFromSheetCells(row.billingStreet, row.wineryAddress);
  if (!resolved) return null;

  const patch: Record<string, string | null | boolean> = {
    exhibitor_legal_name: row.billingCompany.trim() || row.wineryName.trim(),
    exhibitor_company_name: row.wineryName.trim() || row.billingCompany.trim(),
    brands_poured: formatRosterWineDisplay(row.wineName, row.vintage) || null,
    billing_contact_name: row.billingContactName.trim() || null,
    billing_contact_email: row.billingEmail.trim() || null,
    billing_address_line1: resolved.line1,
    billing_address_line2: null,
    billing_city: row.billingCity.trim() || null,
    billing_state: row.billingState.trim() || null,
    billing_zip: row.billingZip.trim() || null,
    billing_country: row.billingCountry.trim() || null,
    billing_same_as_corporate: resolved.usedWineryStreet,
  };

  if (!SIGNER_LOCKED_STATUSES.includes(contract.status)) {
    patch.signer_1_name = row.signerName.trim() || null;
    patch.signer_1_email = row.signerEmail.trim() || null;
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
  if (!payload.billing) return null;

  const patch: Record<string, string | null | boolean> = {
    exhibitor_legal_name: payload.exhibitor_legal_name,
    exhibitor_company_name: payload.exhibitor_company_name,
    brands_poured: payload.brands_poured,
    ...payload.billing,
  };

  if (!SIGNER_LOCKED_STATUSES.includes(contract.status)) {
    patch.signer_1_name = payload.signer_1_name;
    patch.signer_1_email = payload.signer_1_email;
    patch.event_contact_name = payload.event_contact_name;
    patch.event_contact_email = payload.event_contact_email;
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
  let updated = 0;

  for (const contract of (contracts ?? []) as ContractWithTotals[]) {
    if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) continue;
    const rowKey = rosterRowKey(contract.source_sheet_id, contract.source_sheet_tab, contract.source_row_number);
    const row = rowByKey.get(rowKey);
    if (!row) continue;

    const patch = contractPatchFromExhibitorRosterRow(row, contract);
    if (!patch || !patchChanged(contract, patch)) continue;

    const { error } = await supabase.from('contracts').update(patch).eq('id', contract.id);
    if (error) {
      console.error('[syncLinkedContractsFromRosterRows]', contract.id, error.message);
      continue;
    }
    updated += 1;
    revalidateContractPaths(contract.id);
  }

  return updated;
}
