import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { writeExhibitorRosterStatusForContract } from '@/lib/exhibitor-roster-writeback';
import {
  buildContractPayloadFromRosterRow,
  parseRosterRowKey,
  ROSTER_MISSING_ADDRESS_MESSAGE,
} from '@/lib/exhibitor-roster';
import { getSheetsClient } from '@/lib/sheets-tracker';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

async function readRosterHeaders(spreadsheetId: string, tab: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(tab, 'A1:AZ1'),
  });
  return ((res.data.values?.[0] ?? []) as string[]).map((v) => String(v ?? '').trim());
}

async function readRosterRow(spreadsheetId: string, tab: string, rowNumber: number): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(tab, `A${rowNumber}:AZ${rowNumber}`),
    valueRenderOption: 'FORMATTED_VALUE',
  });
  return ((res.data.values?.[0] ?? []) as string[]).map((v) => String(v ?? '').trim());
}

export async function createContractsFromRosterRows(options: {
  event: Event;
  items: { rowKey: string; listKey: string }[];
  actorEmail: string;
}): Promise<{
  created: { rowKey: string; contractId: string }[];
  skipped: { rowKey: string; reason: string }[];
  errors: { rowKey: string; reason: string }[];
}> {
  const supabase = getSupabaseAdmin();
  const created: { rowKey: string; contractId: string }[] = [];
  const skipped: { rowKey: string; reason: string }[] = [];
  const errors: { rowKey: string; reason: string }[] = [];

  for (const item of options.items) {
    const rowKey = item.rowKey;
    const parsed = parseRosterRowKey(rowKey);
    if (!parsed) {
      errors.push({ rowKey, reason: 'Invalid row key' });
      continue;
    }

    const { data: existing } = await supabase
      .from('contracts')
      .select('id')
      .eq('source_sheet_id', parsed.spreadsheetId)
      .eq('source_sheet_tab', parsed.tab)
      .eq('source_row_number', parsed.rowNumber)
      .maybeSingle();

    if (existing?.id) {
      skipped.push({ rowKey, reason: 'License already exists' });
      continue;
    }

    try {
      const [headers, row] = await Promise.all([
        readRosterHeaders(parsed.spreadsheetId, parsed.tab),
        readRosterRow(parsed.spreadsheetId, parsed.tab, parsed.rowNumber),
      ]);
      const payload = buildContractPayloadFromRosterRow(row, item.listKey, options.event, headers);
      if (!payload.exhibitor_company_name.trim()) {
        errors.push({ rowKey, reason: 'Missing winery name' });
        continue;
      }
      if (!payload.signer_1_email?.trim()) {
        errors.push({ rowKey, reason: 'Missing signer email' });
        continue;
      }
      if (!payload.billing?.billing_address_line1?.trim()) {
        errors.push({ rowKey, reason: ROSTER_MISSING_ADDRESS_MESSAGE });
        continue;
      }

      const { data, error } = await supabase
        .from('contracts')
        .insert({
          event_id: options.event.id,
          exhibitor_legal_name: payload.exhibitor_legal_name,
          exhibitor_company_name: payload.exhibitor_company_name,
          order_type: 'booth',
          brands_poured: payload.brands_poured,
          booth_count: payload.booth_count,
          booth_rate_cents: payload.booth_rate_cents,
          signer_1_name: payload.signer_1_name,
          signer_1_title: null,
          signer_1_email: payload.signer_1_email,
          sales_rep_id: null,
          created_by: options.actorEmail,
          status: 'draft',
          ...(payload.billing ?? {}),
          source_sheet_id: parsed.spreadsheetId,
          source_sheet_tab: parsed.tab,
          source_row_number: parsed.rowNumber,
        })
        .select()
        .single();

      if (error || !data) {
        errors.push({ rowKey, reason: error?.message ?? 'Insert failed' });
        continue;
      }

      const contract = data as Contract;
      await supabase.from('audit_log').insert({
        contract_id: contract.id,
        actor_email: options.actorEmail,
        action: 'contract_created',
        to_status: 'draft',
        metadata: { source: 'exhibitor_roster', row_key: rowKey },
      });

      const { data: withTotals } = await supabase
        .from('contracts_with_totals')
        .select('*')
        .eq('id', contract.id)
        .maybeSingle<ContractWithTotals>();

      if (withTotals) {
        await writeExhibitorRosterStatusForContract(withTotals);
      }

      revalidateContractPaths(contract.id);
      created.push({ rowKey, contractId: contract.id });
    } catch (err) {
      errors.push({ rowKey, reason: err instanceof Error ? err.message : 'Failed to create license' });
    }
  }

  return { created, skipped, errors };
}
