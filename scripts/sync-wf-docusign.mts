#!/usr/bin/env npx tsx
/**
 * Full WhiskyFest DocuSign refresh: sent/error → partially_signed → signed → executed.
 *
 * Usage (from whiskyfest-contracts/):
 *   set -a && source .env.production.local && set +a && npx tsx scripts/sync-wf-docusign.mts
 *   npx tsx scripts/sync-wf-docusign.mts   # loads .env.production.local or .env.local
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDocuSignRateLimitError } from '../lib/docusign.ts';
import { syncContractFromDocuSign } from '../lib/docusign-envelope-sync.ts';
import { fetchContractWithTotalsById } from '../lib/contract-with-totals.ts';
import { PRODUCT_WHISKYFEST } from '../lib/product-portal.ts';
import { getSupabaseAdmin } from '../lib/supabase.ts';
import { autoReleaseAfterFullySigned } from '../lib/auto-release-accounting.ts';
import type { Event } from '../types/db.ts';

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v && !process.env[k]) process.env[k] = v;
  }
  return true;
}

loadEnvFile('.env.production.local');
loadEnvFile('.env.local'); // fill Sensitive keys Vercel CLI leaves blank (e.g. service role)

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

async function main() {
  const supabase = getSupabaseAdmin();
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('*')
    .eq('product_key', PRODUCT_WHISKYFEST)
    .eq('is_active', true);

  if (evErr) throw new Error(evErr.message);
  const wfEvents = (events ?? []) as Event[];
  const eventIds = wfEvents.map((e) => e.id);
  const eventById = new Map(wfEvents.map((e) => [e.id, e]));

  if (eventIds.length === 0) {
    console.log('No active WhiskyFest events.');
    return;
  }

  console.log(
    'WhiskyFest events:',
    wfEvents.map((e) => `${e.name} ${e.year} (${e.id})`).join(', '),
  );

  const { data: statusRows } = await supabase
    .from('contracts')
    .select('status')
    .in('event_id', eventIds);
  const before: Record<string, number> = {};
  for (const row of statusRows ?? []) {
    const s = String((row as { status: string }).status);
    before[s] = (before[s] ?? 0) + 1;
  }
  console.log('Status before:', before);

  const { data: pending } = await supabase
    .from('contracts')
    .select('id, status, exhibitor_company_name')
    .in('event_id', eventIds)
    .in('status', ['sent', 'error', 'partially_signed'])
    .not('docusign_envelope_id', 'is', null)
    .order('sent_at', { ascending: false, nullsFirst: false });

  const ids = (pending ?? []).map((r) => r.id as string);
  console.log(`Polling DocuSign for ${ids.length} in-flight contracts (force)…`);

  const syncResult = {
    scanned: 0,
    partiallySigned: 0,
    fullySigned: 0,
    executed: 0,
    unchanged: 0,
    errors: 0,
    errorSamples: [] as { id: string; company: string; error: string }[],
  };

  await mapWithConcurrency(ids, 3, async (id) => {
    if (
      syncResult.errors > 0 &&
      syncResult.errorSamples.some((e) => isDocuSignRateLimitError(new Error(e.error)))
    ) {
      return;
    }

    const contract = await fetchContractWithTotalsById(supabase, id);
    if (!contract?.docusign_envelope_id?.trim()) return;
    const event = eventById.get(contract.event_id);
    if (!event) return;

    syncResult.scanned += 1;
    try {
      const sync = await syncContractFromDocuSign(supabase, contract, event, null, {
        notify: false,
        forcePoll: true,
      });
      if (!sync.ok) {
        syncResult.errors += 1;
        if (syncResult.errorSamples.length < 10) {
          syncResult.errorSamples.push({
            id: contract.id,
            company: contract.exhibitor_company_name,
            error: sync.error,
          });
        }
        return;
      }
      if (!sync.changed) {
        syncResult.unchanged += 1;
        return;
      }
      if (sync.toStatus === 'partially_signed') syncResult.partiallySigned += 1;
      else if (sync.toStatus === 'signed') syncResult.fullySigned += 1;
      else if (sync.toStatus === 'executed') syncResult.executed += 1;
      else syncResult.unchanged += 1;
      console.log(
        `  ${contract.exhibitor_company_name}: ${sync.fromStatus} → ${sync.toStatus}`,
      );
    } catch (err) {
      syncResult.errors += 1;
      if (syncResult.errorSamples.length < 10) {
        syncResult.errorSamples.push({
          id: contract.id,
          company: contract.exhibitor_company_name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  const { data: signedStuck } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .in('event_id', eventIds)
    .eq('status', 'signed')
    .is('executed_at', null)
    .limit(100);

  let released = 0;
  let releaseFailed = 0;
  for (const row of signedStuck ?? []) {
    const event = eventById.get(row.event_id as string);
    if (!event) continue;
    const release = await autoReleaseAfterFullySigned({
      supabase,
      contractId: row.id as string,
      event,
      countersignerEmail: (row as { countersigned_by_email?: string | null }).countersigned_by_email,
    });
    if (release.released) {
      released += 1;
      console.log(`  Released to accounting: ${(row as { exhibitor_company_name: string }).exhibitor_company_name}`);
    } else if (release.error) {
      releaseFailed += 1;
      console.warn(`  Release failed: ${(row as { exhibitor_company_name: string }).exhibitor_company_name}: ${release.error}`);
    }
  }

  const { data: afterRows } = await supabase
    .from('contracts')
    .select('status')
    .in('event_id', eventIds);
  const after: Record<string, number> = {};
  for (const row of afterRows ?? []) {
    const s = String((row as { status: string }).status);
    after[s] = (after[s] ?? 0) + 1;
  }

  console.log('\nSync result:', syncResult);
  console.log('Released to accounting:', { released, releaseFailed, scannedSigned: signedStuck?.length ?? 0 });
  console.log('Status after:', after);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
