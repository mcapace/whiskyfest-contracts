#!/usr/bin/env tsx
/**
 * Restore NYWE portal names from the signed PDF licensee when roster row-shift
 * overwrote exhibitor_company_name / legal name onto the wrong winery.
 *
 * Usage:
 *   npx tsx scripts/repair-nywe-roster-identity.mts
 *   npx tsx scripts/repair-nywe-roster-identity.mts --apply
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getSupabaseAdmin } from '../lib/supabase';
import { rosterIdentitiesMatch } from '../lib/nywe-roster-identity';
import { downloadContractPdfFromStorage } from '../lib/contract-pdf-storage';

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v && !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local');

function extractLicensee(text: string): string {
  const m = text.match(/,\s*and\s+(.+?)\s+\("Licensee"\)/i);
  return (m?.[1] ?? '').replace(/\s+/g, ' ').trim();
}

async function pdfText(bytes: Buffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  let text = '';
  const max = Math.min(doc.numPages, 2);
  for (let i = 1; i <= max; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: { str?: string }) => it.str ?? '').join(' ') + ' ';
  }
  return text;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const sb = getSupabaseAdmin();
  const { data: event } = await sb
    .from('events')
    .select('id')
    .eq('product_key', 'wine_spectator')
    .eq('is_active', true)
    .maybeSingle();
  if (!event) throw new Error('No active NYWE event');

  const { data: contracts, error } = await sb
    .from('contracts')
    .select(
      'id, exhibitor_company_name, exhibitor_legal_name, signer_1_name, signer_1_email, status, pdf_storage_path',
    )
    .eq('event_id', event.id)
    .in('status', ['executed', 'signed', 'sent', 'partially_signed']);
  if (error) throw error;

  let mismatch = 0;
  let updated = 0;
  let skipped = 0;

  for (const c of contracts ?? []) {
    const path = c.pdf_storage_path || `${c.id}/signed.pdf`;
    let bytes: Buffer | null = null;
    for (const p of [path, `${c.id}/signed.pdf`, `${c.id}/draft.pdf`]) {
      try {
        bytes = await downloadContractPdfFromStorage(p);
        break;
      } catch {
        bytes = null;
      }
    }
    if (!bytes) {
      skipped += 1;
      continue;
    }

    const licensee = extractLicensee(await pdfText(bytes));
    if (!licensee) {
      skipped += 1;
      continue;
    }

    const ok =
      rosterIdentitiesMatch(licensee, c.exhibitor_company_name) ||
      rosterIdentitiesMatch(licensee, c.exhibitor_legal_name);
    if (ok) continue;

    mismatch += 1;
    console.log(
      `${c.exhibitor_company_name}  →  ${licensee}  | signer ${c.signer_1_name} | ${c.id}`,
    );

    if (!apply) continue;

    const { error: upErr } = await sb
      .from('contracts')
      .update({
        exhibitor_company_name: licensee,
        exhibitor_legal_name: licensee,
      })
      .eq('id', c.id);
    if (upErr) {
      console.error('update failed', c.id, upErr.message);
      continue;
    }
    await sb.from('audit_log').insert({
      contract_id: c.id,
      actor_email: 'system@whiskyfest-contracts',
      action: 'nywe_identity_restored_from_pdf',
      metadata: {
        previous_company: c.exhibitor_company_name,
        previous_legal: c.exhibitor_legal_name,
        restored_licensee: licensee,
        signer_unchanged: c.signer_1_name,
      },
    });
    updated += 1;
  }

  console.log(
    `\n${apply ? 'Applied' : 'Dry run'}: ${mismatch} name/PDF mismatches, ${updated} updated, ${skipped} skipped (no pdf/licensee).`,
  );
  if (!apply && mismatch > 0) {
    console.log('Re-run with --apply to restore portal names from signed PDFs.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
