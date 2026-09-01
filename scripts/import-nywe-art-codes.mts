/**
 * Import NYWE booth art codes + booth numbers from Lisa's TOC spreadsheet.
 *
 * Usage:
 *   npx tsx scripts/import-nywe-art-codes.mts
 *   npx tsx scripts/import-nywe-art-codes.mts --sheet=/path/to/file.xlsx
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import { scoreNyweWineryMatch } from '../lib/nywe-art-codes';
import { getActiveWineSpectatorEvent } from '../lib/wine-spectator-event';
import { listNyweExecutedBoothQrContracts } from '../lib/nywe-booth-qr';
import { getSupabaseAdmin } from '../lib/supabase';

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v && !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

type SheetRow = { booth: string | null; art: string | null; winery: string };

function readSheet(path: string): SheetRow[] {
  const py = `
import openpyxl, json, sys
path = sys.argv[1]
wb = openpyxl.load_workbook(path, data_only=True)
ws = wb['ALPHA BY WINERY'] if 'ALPHA BY WINERY' in wb.sheetnames else wb[wb.sheetnames[0]]
rows = []
for r in range(2, ws.max_row + 1):
    booth = ws.cell(r, 1).value
    art = ws.cell(r, 2).value
    winery = ws.cell(r, 3).value
    if winery is None:
        continue
    rows.append({
        'booth': None if booth is None else str(booth).strip(),
        'art': None if art is None else str(art).strip(),
        'winery': str(winery).strip(),
    })
print(json.dumps(rows))
`;
  const result = spawnSync('python3', ['-c', py, path], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `/tmp/xlsxenv/bin:${process.env.PATH ?? ''}`,
    },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to parse spreadsheet (need openpyxl).');
  }
  return JSON.parse(result.stdout) as SheetRow[];
}

async function main() {
  const sheetArg = process.argv.find((a) => a.startsWith('--sheet='));
  const sheetPath =
    sheetArg?.slice('--sheet='.length) ||
    resolve(process.cwd(), 'scripts/data/2026-nywe-booth-artcodes.xlsx');

  if (!existsSync(sheetPath)) {
    throw new Error(`Spreadsheet not found: ${sheetPath}`);
  }

  const event = await getActiveWineSpectatorEvent();
  if (!event) throw new Error('No active Wine Spectator event.');

  const sheetRows = readSheet(sheetPath);
  const contracts = await listNyweExecutedBoothQrContracts(event.id);
  const used = new Set<string>();
  const updates: { id: string; art_code: string; booth_number: string | null; name: string; sheet: string }[] =
    [];
  const unmatched: { sheet: string; art: string | null; candidates: string[] }[] = [];

  for (const row of sheetRows) {
    if (!row.art) continue;
    const scored = contracts
      .filter((c) => !used.has(c.id))
      .map((c) => ({
        contract: c,
        score: scoreNyweWineryMatch(row.winery, c.exhibitor_company_name),
      }))
      .filter((s) => s.score >= 55)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];
    if (!best || (second && best.score < 95 && best.score - second.score < 5)) {
      unmatched.push({
        sheet: row.winery,
        art: row.art,
        candidates: scored.slice(0, 3).map((s) => `${s.contract.exhibitor_company_name} (${s.score.toFixed(0)})`),
      });
      continue;
    }

    const sameName = contracts.filter(
      (c) => c.exhibitor_company_name === best.contract.exhibitor_company_name,
    );
    for (const c of sameName) {
      used.add(c.id);
      updates.push({
        id: c.id,
        art_code: row.art,
        booth_number: row.booth,
        name: c.exhibitor_company_name,
        sheet: row.winery,
      });
    }
  }

  const supabase = getSupabaseAdmin();
  let updated = 0;
  for (const row of updates) {
    const { error } = await supabase
      .from('contracts')
      .update({ art_code: row.art_code, booth_number: row.booth_number })
      .eq('id', row.id);
    if (error) throw new Error(`${row.name}: ${error.message}`);
    updated += 1;
  }

  const leftover = contracts.filter((c) => !used.has(c.id));
  console.log(
    JSON.stringify(
      {
        event: event.name,
        sheetRows: sheetRows.length,
        contracts: contracts.length,
        updated,
        unmatchedSheet: unmatched.length,
        leftoverContracts: leftover.map((c) => c.exhibitor_company_name),
        unmatchedSample: unmatched.slice(0, 40),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
