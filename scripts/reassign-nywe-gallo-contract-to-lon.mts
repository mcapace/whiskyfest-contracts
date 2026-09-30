#!/usr/bin/env npx tsx
/**
 * Reassign the NYWE Gallo license so everything goes to Lon Gallagher:
 *   - DocuSign signer (signer_1_name / signer_1_email)
 *   - primary / event contact (event_contact_name / event_contact_email)
 *   - billing contact (billing_contact_name / billing_contact_email)
 *
 * It updates BOTH places the portal reads from:
 *   1. The linked Google Sheets roster row (PRIMARY CONTACT, BILLING CONTACT,
 *      CONTRACT REPRESENTATIVE columns). The portal re-pulls this row on every
 *      Generate / Send, so fixing only the database would be overwritten.
 *   2. The `contracts` row in Supabase (+ an audit_log entry).
 *
 * Usage:
 *   vercel env pull .env.local                                   # once
 *   npx tsx scripts/reassign-nywe-gallo-contract-to-lon.mts --dry-run
 *   npx tsx scripts/reassign-nywe-gallo-contract-to-lon.mts
 *
 * Options:
 *   --contract-id <uuid>  Contract to update (default: the consolidated Gallo license).
 *   --actor <email>       Recorded in audit_log.actor_email (default: script).
 *   --skip-sheet          Only update the database.
 *   --skip-db             Only update the Google Sheet row.
 *   --dry-run             Print what would change without writing anything.
 *
 * After it runs, open the contract in the NYWE portal and click Send — the PDF
 * is re-rendered and the DocuSign envelope goes to Lon.
 */
import { existsSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Helpers below are copied from lib/sheets-tracker.ts and lib/nywe-roster-identity.ts so this
// script only depends on npm packages (importing ../lib/*.ts breaks under Node's native
// type stripping on newer Node 22 releases).

/** Same service account JSON as Drive/Docs; spreadsheets scope. */
function getSheetsClient() {
  const keyB64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY']?.trim();
  if (!keyB64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY env var');
  const credentials = JSON.parse(Buffer.from(keyB64, 'base64').toString('utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/** UUID from the sheet CONTRACT ID cell (ignores extra text). */
function normalizeSheetContractId(raw: string | null | undefined): string | null {
  const match = (raw ?? '')
    .trim()
    .toLowerCase()
    .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  return match?.[0] ?? null;
}

function normalizeRosterIdentity(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(ltd|llc|inc|sa|srl|spa|soc|agricola)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rosterIdentitiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeRosterIdentity(a);
  const right = normalizeRosterIdentity(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  if (shorter.length >= 8 && longer.includes(shorter)) return true;
  const leftTokens = left.split(' ').filter((w) => w.length > 2);
  const rightTokens = right.split(' ').filter((w) => w.length > 2);
  if (leftTokens.length < 2 || rightTokens.length < 2) return false;
  const rightSet = new Set(rightTokens);
  const hits = leftTokens.filter((w) => rightSet.has(w)).length;
  return hits >= 2;
}

/** True when the Google Sheet row is still the same winery as this contract. */
function rosterRowMatchesContract(
  row: { wineryName?: string | null; billingCompany?: string | null },
  contract: { exhibitor_company_name?: string | null; exhibitor_legal_name?: string | null },
): boolean {
  const rowNames = [row.wineryName, row.billingCompany];
  const contractNames = [contract.exhibitor_company_name, contract.exhibitor_legal_name];
  return rowNames.some((rowName) =>
    contractNames.some((contractName) => rosterIdentitiesMatch(rowName, contractName)),
  );
}

/** Consolidated NYWE 2026 Gallo license (recalled 2026-09-30 to change the recipient). */
const DEFAULT_CONTRACT_ID = 'd21e327c-c85e-450d-8785-bc0dab9362e6';

const NEW_CONTACT = {
  firstName: 'Lon',
  lastName: 'Gallagher',
  fullName: 'Lon Gallagher',
  email: 'lon.gallagher@ejgallo.com',
} as const;

/** Sheet headers → new value. Header match is exact, case-insensitive, trimmed. */
const SHEET_CELL_UPDATES: Array<{ header: string; value: string }> = [
  { header: 'PRIMARY CONTACT FIRST NAME', value: NEW_CONTACT.firstName },
  { header: 'PRIMARY CONTACT LAST NAME', value: NEW_CONTACT.lastName },
  { header: 'PRIMARY CONTACT EMAIL', value: NEW_CONTACT.email },
  { header: 'BILLING CONTACT FIRST NAME', value: NEW_CONTACT.firstName },
  { header: 'BILLING CONTACT LAST NAME', value: NEW_CONTACT.lastName },
  { header: 'BILLING CONTACT EMAIL', value: NEW_CONTACT.email },
  { header: 'CONTRACT REPRESENTATIVE FIRST NAME', value: NEW_CONTACT.firstName },
  { header: 'CONTRACT REPRESENTATIVE LAST NAME', value: NEW_CONTACT.lastName },
  { header: 'CONTRACT REPRESENTATIVE EMAIL ADDRESS', value: NEW_CONTACT.email },
];

/** Once a DocuSign envelope is out, the signer belongs to DocuSign (see lib/nywe-roster-contract-sync.ts). */
const SIGNER_LOCKED_STATUSES = new Set(['sent', 'partially_signed', 'signed', 'executed']);
const TERMINAL_STATUSES = new Set(['executed', 'voided', 'cancelled']);

type ContractRow = {
  id: string;
  status: string;
  event_id: string;
  exhibitor_company_name: string | null;
  exhibitor_legal_name: string | null;
  signer_1_name: string | null;
  signer_1_email: string | null;
  event_contact_name: string | null;
  event_contact_email: string | null;
  billing_contact_name: string | null;
  billing_contact_email: string | null;
  source_sheet_id: string | null;
  source_sheet_tab: string | null;
  source_row_number: number | null;
  docusign_envelope_id: string | null;
};

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const skipSheet = argv.includes('--skip-sheet');
const skipDb = argv.includes('--skip-db');

function argValue(flag: string): string | null {
  const idx = argv.indexOf(flag);
  if (idx < 0) return null;
  const value = argv[idx + 1];
  return value && !value.startsWith('--') ? value : null;
}

function loadEnvLocal(): void {
  if (process.env['NEXT_PUBLIC_SUPABASE_URL'] && process.env['SUPABASE_SERVICE_ROLE_KEY']) return;
  const loader = (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile;
  if (typeof loader !== 'function') return;
  for (const file of ['.env.local', '.env']) {
    if (existsSync(file)) {
      loader.call(process, file);
      return;
    }
  }
}

function tabRange(tab: string, a1: string): string {
  const needsQuote = /\s|'/.test(tab);
  const safe = needsQuote ? `'${tab.replace(/'/g, "''")}'` : tab;
  return `${safe}!${a1}`;
}

function colToLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function show(value: string | null | undefined): string {
  return value && value.trim() ? value : '(empty)';
}

async function updateSheetRow(contract: ContractRow): Promise<void> {
  const spreadsheetId = contract.source_sheet_id?.trim();
  const tab = contract.source_sheet_tab?.trim();
  const rowNumber = contract.source_row_number;
  if (!spreadsheetId || !tab || !rowNumber || rowNumber < 2) {
    console.warn('⚠️  Contract has no linked roster row (source_sheet_id/tab/row) — skipping sheet update.');
    return;
  }

  const sheets = getSheetsClient();
  const [headerRes, rowRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId, range: tabRange(tab, 'A1:AZ1') }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: tabRange(tab, `A${rowNumber}:AZ${rowNumber}`),
      valueRenderOption: 'FORMATTED_VALUE',
    }),
  ]);
  const headers = ((headerRes.data.values?.[0] ?? []) as string[]).map((h) => String(h ?? '').trim());
  const row = ((rowRes.data.values?.[0] ?? []) as string[]).map((v) => String(v ?? '').trim());

  const headerIndex = (label: string): number =>
    headers.findIndex((h) => h.toUpperCase() === label.toUpperCase());

  // Safety: make sure the linked row is still this contract (sheets get sorted).
  const contractIdIdx = headerIndex('CONTRACT ID');
  const wineryIdx = headerIndex('NAME OF PARTICIPATING WINERY');
  const billingCompanyIdx = headerIndex('BILLING COMPANY NAME');
  const sheetContractId = contractIdIdx >= 0 ? normalizeSheetContractId(row[contractIdIdx]) : null;
  const rowIdentity = {
    wineryName: wineryIdx >= 0 ? row[wineryIdx] : null,
    billingCompany: billingCompanyIdx >= 0 ? row[billingCompanyIdx] : null,
  };
  const belongs = sheetContractId
    ? sheetContractId === contract.id.toLowerCase()
    : rosterRowMatchesContract(rowIdentity, contract);
  if (!belongs) {
    throw new Error(
      `Roster row ${rowNumber} on tab "${tab}" is not this contract ` +
        `(sheet CONTRACT ID=${sheetContractId ?? 'empty'}, winery=${rowIdentity.wineryName ?? ''}). ` +
        'Fix source_row_number on the contract first (scripts/repair-nywe-roster-identity.mts).',
    );
  }

  console.log(`\n📄 Roster sheet ${spreadsheetId} · tab "${tab}" · row ${rowNumber}`);
  console.log(`   Winery: ${show(rowIdentity.wineryName)} · Billing company: ${show(rowIdentity.billingCompany)}`);

  const data: Array<{ range: string; values: string[][] }> = [];
  for (const { header, value } of SHEET_CELL_UPDATES) {
    const idx = headerIndex(header);
    if (idx < 0) {
      console.warn(`   ⚠️  Column "${header}" not found on this tab — skipped.`);
      continue;
    }
    const current = row[idx] ?? '';
    const cell = `${colToLetter(idx)}${rowNumber}`;
    if (current === value) {
      console.log(`   = ${cell} ${header}: already "${value}"`);
      continue;
    }
    console.log(`   → ${cell} ${header}: "${show(current)}" → "${value}"`);
    data.push({ range: tabRange(tab, cell), values: [[value]] });
  }

  if (data.length === 0) {
    console.log('   Nothing to change on the sheet.');
    return;
  }
  if (dryRun) {
    console.log(`   [dry-run] would write ${data.length} cell(s).`);
    return;
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
  console.log(`   ✅ Wrote ${data.length} cell(s) to the roster sheet.`);
}

async function updateContractRow(
  supabase: SupabaseClient,
  contract: ContractRow,
  actorEmail: string,
): Promise<void> {
  const signerLocked = SIGNER_LOCKED_STATUSES.has(contract.status);

  const patch: Record<string, string> = {
    event_contact_name: NEW_CONTACT.fullName,
    event_contact_email: NEW_CONTACT.email,
    billing_contact_name: NEW_CONTACT.fullName,
    billing_contact_email: NEW_CONTACT.email,
  };
  if (!signerLocked) {
    patch['signer_1_name'] = NEW_CONTACT.fullName;
    patch['signer_1_email'] = NEW_CONTACT.email;
  }

  console.log(`\n🗄️  Contract ${contract.id} (${show(contract.exhibitor_company_name)}, status: ${contract.status})`);
  const before: Record<string, string | null> = {
    signer_1_name: contract.signer_1_name,
    signer_1_email: contract.signer_1_email,
    event_contact_name: contract.event_contact_name,
    event_contact_email: contract.event_contact_email,
    billing_contact_name: contract.billing_contact_name,
    billing_contact_email: contract.billing_contact_email,
  };
  const changed = Object.entries(patch).filter(([k, v]) => (before[k] ?? '').trim() !== v);
  for (const [key, value] of Object.entries(patch)) {
    const marker = (before[key] ?? '').trim() === value ? '=' : '→';
    console.log(`   ${marker} ${key}: "${show(before[key])}" → "${value}"`);
  }
  if (signerLocked) {
    console.warn(
      `   ⚠️  Status "${contract.status}" — signer is owned by DocuSign and was NOT changed here.\n` +
        '      In the portal use "Resend with Changes" with Lon Gallagher / lon.gallagher@ejgallo.com ' +
        '(voids the old envelope and sends a new one), or Recall the contract and re-run this script.',
    );
  }

  if (changed.length === 0) {
    console.log('   Nothing to change in the database.');
    return;
  }
  if (dryRun) {
    console.log(`   [dry-run] would update ${changed.length} field(s) and add an audit_log entry.`);
    return;
  }

  const { error } = await supabase.from('contracts').update(patch).eq('id', contract.id);
  if (error) throw new Error(`contracts update failed: ${error.message}`);

  const { error: auditError } = await supabase.from('audit_log').insert({
    contract_id: contract.id,
    actor_email: actorEmail,
    action: 'signer_contact_updated',
    metadata: {
      source: 'scripts/reassign-nywe-gallo-contract-to-lon.mts',
      previous_email: contract.signer_1_email,
      new_email: patch['signer_1_email'] ?? contract.signer_1_email,
      previous_event_contact_email: contract.event_contact_email,
      new_event_contact_email: NEW_CONTACT.email,
      previous_billing_contact_email: contract.billing_contact_email,
      new_billing_contact_email: NEW_CONTACT.email,
      signer_locked: signerLocked,
    },
  });
  if (auditError) console.warn(`   ⚠️  audit_log insert failed (contract was updated): ${auditError.message}`);

  console.log(`   ✅ Updated ${changed.length} field(s).`);
}

async function main() {
  loadEnvLocal();

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    console.error('   Run `vercel env pull .env.local` first (or export them in the shell).');
    process.exit(1);
  }
  if (!skipSheet && !process.env['GOOGLE_SERVICE_ACCOUNT_KEY']) {
    console.error('❌ Missing GOOGLE_SERVICE_ACCOUNT_KEY (needed to update the roster sheet). Use --skip-sheet to bypass.');
    process.exit(1);
  }

  const contractId = (argValue('--contract-id') ?? DEFAULT_CONTRACT_ID).trim().toLowerCase();
  const actorEmail = argValue('--actor') ?? 'script:reassign-nywe-gallo-contract-to-lon';
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: contract, error } = await supabase
    .from('contracts')
    .select(
      'id, status, event_id, exhibitor_company_name, exhibitor_legal_name, signer_1_name, signer_1_email, ' +
        'event_contact_name, event_contact_email, billing_contact_name, billing_contact_email, ' +
        'source_sheet_id, source_sheet_tab, source_row_number, docusign_envelope_id',
    )
    .eq('id', contractId)
    .maybeSingle<ContractRow>();
  if (error) throw new Error(`contracts lookup failed: ${error.message}`);

  if (!contract) {
    console.error(`❌ Contract ${contractId} not found. Open NYWE licenses matching "Gallo":`);
    const { data: candidates } = await supabase
      .from('contracts')
      .select('id, status, exhibitor_company_name, exhibitor_legal_name, signer_1_email')
      .or('exhibitor_company_name.ilike.%gallo%,exhibitor_legal_name.ilike.%gallo%')
      .order('created_at', { ascending: false });
    for (const c of (candidates ?? []) as Array<Record<string, string | null>>) {
      if (TERMINAL_STATUSES.has(c['status'] ?? '')) continue;
      console.error(`   ${c['id']}  ${c['status']}  ${c['exhibitor_company_name']} / ${c['exhibitor_legal_name']}  signer=${c['signer_1_email']}`);
    }
    console.error('   Re-run with --contract-id <uuid>.');
    process.exit(1);
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, name, product_key, contract_template_profile')
    .eq('id', contract.event_id)
    .maybeSingle<{ id: string; name: string; product_key: string; contract_template_profile: string | null }>();
  if (event && event.contract_template_profile !== 'nywe_vendor') {
    console.warn(`⚠️  Event "${event.name}" is not a NYWE vendor-license event (profile: ${event.contract_template_profile}).`);
  }

  if (TERMINAL_STATUSES.has(contract.status)) {
    console.error(`❌ Contract is ${contract.status}; nothing to reassign.`);
    process.exit(1);
  }

  console.log(`${dryRun ? '🔍 DRY RUN — ' : ''}Reassigning to ${NEW_CONTACT.fullName} <${NEW_CONTACT.email}>`);
  console.log(`Event: ${event?.name ?? contract.event_id}`);

  if (!skipSheet) await updateSheetRow(contract);
  if (!skipDb) await updateContractRow(supabase, contract, actorEmail);

  const origin = process.env['NYWE_PORTAL_ORIGIN'] ?? 'https://nywecontracts.winespectator.com';
  console.log('\nNext step: open the license in the NYWE portal and click Send —');
  console.log(`  ${origin}/contracts/${contract.id}`);
  console.log('The PDF is re-rendered from the roster row and the DocuSign envelope goes to Lon Gallagher.');
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
