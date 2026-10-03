import { getSupabaseAdmin } from '@/lib/supabase';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { writeExhibitorRosterStatusForContract } from '@/lib/exhibitor-roster-writeback';
import {
  buildContractPayloadFromExhibitorRosterRow,
  buildContractPayloadFromRosterRow,
  parseRosterRowKey,
  ROSTER_MISSING_ADDRESS_MESSAGE,
  type ExhibitorRosterRow,
} from '@/lib/exhibitor-roster';
import { rosterStaleFromEventCache } from '@/lib/exhibitor-roster-sync-job';
import { contractHasNyweLicenseAddress } from '@/lib/nywe-billing';
import { isNyweVendorOnlyEvent } from '@/lib/nywe-pricing';
import {
  emptyCoveredWinery,
  isGalloBillingCompany,
} from '@/lib/nywe-combined-contract';
import { combineGalloContractsForEvent } from '@/lib/nywe-combine-gallo-contracts';
import type { NyweCoveredWinery } from '@/lib/nywe-combined-contract';
import { getSheetsClient } from '@/lib/sheets-tracker';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readRosterHeaders(
  spreadsheetId: string,
  tab: string,
  headerCache: Map<string, string[]>,
): Promise<string[]> {
  const cacheKey = `${spreadsheetId}::${tab}`;
  const cached = headerCache.get(cacheKey);
  if (cached) return cached;

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(tab, 'A1:AZ1'),
  });
  const headers = ((res.data.values?.[0] ?? []) as string[]).map((v) => String(v ?? '').trim());
  headerCache.set(cacheKey, headers);
  return headers;
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

function rosterRowMapFromEvent(event: Event): Map<string, ExhibitorRosterRow> {
  const snapshot = rosterStaleFromEventCache(event);
  const map = new Map<string, ExhibitorRosterRow>();
  for (const row of snapshot?.rows ?? []) {
    map.set(row.rowKey, row);
  }
  return map;
}

async function resolveCreatePayload(
  item: { rowKey: string; listKey: string },
  event: Event,
  cachedRows: Map<string, ExhibitorRosterRow>,
  headerCache: Map<string, string[]>,
) {
  const cached = cachedRows.get(item.rowKey);
  if (cached) {
    return buildContractPayloadFromExhibitorRosterRow(cached, event);
  }

  const parsed = parseRosterRowKey(item.rowKey);
  if (!parsed) throw new Error('Invalid row key');

  const [headers, row] = await Promise.all([
    readRosterHeaders(parsed.spreadsheetId, parsed.tab, headerCache),
    readRosterRow(parsed.spreadsheetId, parsed.tab, parsed.rowNumber),
  ]);
  return buildContractPayloadFromRosterRow(row, item.listKey, event, headers);
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
  const headerCache = new Map<string, string[]>();
  const cachedRows = rosterRowMapFromEvent(options.event);
  const created: { rowKey: string; contractId: string }[] = [];
  const skipped: { rowKey: string; reason: string }[] = [];
  const errors: { rowKey: string; reason: string }[] = [];
  const pendingWritebacks: ContractWithTotals[] = [];
  const galloRows: {
    rowKey: string;
    winery: NyweCoveredWinery;
    seed: {
      signer_1_name: string | null;
      signer_1_email: string | null;
      event_contact_name: string | null;
      event_contact_email: string | null;
      billing: NonNullable<Awaited<ReturnType<typeof resolveCreatePayload>>>['billing'];
    };
  }[] = [];

  let galloRowKeys = new Set<string>();
  if (isNyweVendorOnlyEvent(options.event)) {
    const existingGallo = await combineGalloContractsForEvent({
      supabase,
      event: options.event,
      actorEmail: options.actorEmail,
    });
    galloRowKeys = new Set(existingGallo.coveredRowKeys);
  }

  for (const item of options.items) {
    const rowKey = item.rowKey;
    const parsed = parseRosterRowKey(rowKey);
    if (!parsed) {
      errors.push({ rowKey, reason: 'Invalid row key' });
      continue;
    }

    if (galloRowKeys.has(rowKey)) {
      skipped.push({ rowKey, reason: 'Already on the Gallo contract' });
      continue;
    }

    const { data: existingRows } = await supabase
      .from('contracts')
      .select('id, status')
      .eq('source_sheet_id', parsed.spreadsheetId)
      .eq('source_sheet_tab', parsed.tab)
      .eq('source_row_number', parsed.rowNumber);
    const existing = (existingRows ?? []).find((row) => row.status !== 'cancelled' && row.status !== 'voided');

    if (existing?.id) {
      skipped.push({ rowKey, reason: 'License already exists' });
      continue;
    }

    try {
      const payload = await resolveCreatePayload(item, options.event, cachedRows, headerCache);
      if (!payload.exhibitor_company_name.trim()) {
        errors.push({ rowKey, reason: 'Missing winery name' });
        continue;
      }
      if (!payload.signer_1_email?.trim()) {
        errors.push({ rowKey, reason: 'Missing signer email' });
        continue;
      }
      if (!payload.billing || !contractHasNyweLicenseAddress(payload.billing)) {
        errors.push({ rowKey, reason: ROSTER_MISSING_ADDRESS_MESSAGE });
        continue;
      }

      if (isGalloBillingCompany(payload.exhibitor_legal_name) || isGalloBillingCompany(payload.exhibitor_company_name)) {
        const winery = emptyCoveredWinery(payload.exhibitor_company_name);
        winery.website_url = payload.exhibitor_website_url;
        winery.wine_display = payload.brands_poured;
        winery.source_rows = [
          {
            source_sheet_id: parsed.spreadsheetId,
            source_sheet_tab: parsed.tab,
            source_row_number: parsed.rowNumber,
          },
        ];
        galloRows.push({
          rowKey,
          winery,
          seed: {
            signer_1_name: payload.signer_1_name,
            signer_1_email: payload.signer_1_email,
            event_contact_name: payload.event_contact_name,
            event_contact_email: payload.event_contact_email,
            billing: payload.billing,
          },
        });
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
          exhibitor_website_url: payload.exhibitor_website_url,
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
        pendingWritebacks.push(withTotals);
      }

      revalidateContractPaths(contract.id);
      created.push({ rowKey, contractId: contract.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create license';
      errors.push({
        rowKey,
        reason: /quota exceeded/i.test(message)
          ? 'Google Sheets quota exceeded — wait 2 minutes and try again, or create in smaller batches.'
          : message,
      });
    }
  }

  if (galloRows.length > 0) {
    const first = galloRows[0]!;
    const combined = await combineGalloContractsForEvent({
      supabase,
      event: options.event,
      actorEmail: options.actorEmail,
      additionalWineries: galloRows.map((row) => row.winery),
      seed: {
        signer_1_name: first.seed.signer_1_name,
        signer_1_email: first.seed.signer_1_email,
        event_contact_name: first.seed.event_contact_name,
        event_contact_email: first.seed.event_contact_email,
        billing: first.seed.billing,
      },
    });
    const locked = new Set(combined.skippedLockedWineries.map((name) => name.toLowerCase()));
    for (const row of galloRows) {
      if (locked.has(row.winery.winery_name.trim().toLowerCase())) {
        skipped.push({
          rowKey: row.rowKey,
          reason: `${row.winery.winery_name} is already on a Gallo contract that was sent for signature`,
        });
        continue;
      }
      if (!combined.contractId) {
        errors.push({ rowKey: row.rowKey, reason: 'Could not add this winery to the Gallo contract' });
        continue;
      }
      created.push({ rowKey: row.rowKey, contractId: combined.contractId });
    }
  }

  for (let i = 0; i < pendingWritebacks.length; i++) {
    if (i > 0) await sleep(1200);
    try {
      await writeExhibitorRosterStatusForContract(pendingWritebacks[i]!);
    } catch (err) {
      console.error(
        '[createContractsFromRosterRows] sheet writeback failed',
        pendingWritebacks[i]!.id,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { created, skipped, errors };
}
