import { buildContractPayloadFromRosterRow } from '@/lib/exhibitor-roster';
import { eventTemplateProfile } from '@/lib/contract-template-profile';
import type { NyweBillingFields } from '@/lib/nywe-billing';
import { getSheetsClient } from '@/lib/sheets-tracker';
import type { Contract, ContractWithTotals, Event } from '@/types/db';
import type { SupabaseClient } from '@supabase/supabase-js';

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function rosterListKeyFromTab(tab: string): string {
  return tab.toLowerCase().includes('new') ? 'new' : 'returning';
}

/** Load billing fields from the linked Google Sheets roster row (NYWE only). */
export async function nyweBillingFromLinkedRosterRow(
  contract: Pick<Contract, 'source_sheet_id' | 'source_sheet_tab' | 'source_row_number'>,
  event: Pick<Event, 'contract_template_profile'>,
): Promise<NyweBillingFields | null> {
  if (eventTemplateProfile(event) !== 'nywe_vendor') return null;
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
  const payload = buildContractPayloadFromRosterRow(row, listKey, event as Event, headers);
  return payload.billing;
}

/**
 * Refresh NYWE billing_* columns from the roster before PDF merge / send.
 * Returns the contract with updated billing when a roster row is linked.
 */
export async function refreshNyweBillingFromRosterForContract(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  event: Event,
): Promise<ContractWithTotals> {
  const billing = await nyweBillingFromLinkedRosterRow(contract, event);
  if (!billing) return contract;

  const { error } = await supabase.from('contracts').update(billing).eq('id', contract.id);
  if (error) {
    console.error('[refreshNyweBillingFromRosterForContract]', contract.id, error.message);
    return contract;
  }

  return { ...contract, ...billing };
}
