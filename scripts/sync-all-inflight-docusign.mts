#!/usr/bin/env npx tsx
/**
 * Force-poll DocuSign for all in-flight contracts across active events
 * (WhiskyFest + NYWE + Big Smoke), then release any newly signed ones.
 *
 * Usage:
 *   npx tsx scripts/sync-all-inflight-docusign.mts
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDocuSignRateLimitError } from '../lib/docusign.ts';
import { syncContractFromDocuSign } from '../lib/docusign-envelope-sync.ts';
import { fetchContractWithTotalsById } from '../lib/contract-with-totals.ts';
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
loadEnvFile('.env.local');

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
    .eq('is_active', true);
  if (evErr) throw new Error(evErr.message);

  const activeEvents = (events ?? []) as Event[];
  const eventIds = activeEvents.map((e) => e.id);
  const eventById = new Map(activeEvents.map((e) => [e.id, e]));

  console.log(
    'Active events:',
    activeEvents.map((e) => `${e.product_key} ${e.name} ${e.year}`).join(' | '),
  );

  const { data: pending } = await supabase
    .from('contracts')
    .select('id, status, exhibitor_company_name, event_id')
    .in('event_id', eventIds)
    .in('status', ['sent', 'error', 'partially_signed'])
    .not('docusign_envelope_id', 'is', null)
    .order('sent_at', { ascending: true, nullsFirst: false });

  const ids = (pending ?? []).map((r) => r.id as string);
  console.log(`Force-polling DocuSign for ${ids.length} in-flight contracts…`);

  const syncResult = {
    scanned: 0,
    partiallySigned: 0,
    fullySigned: 0,
    executed: 0,
    unchanged: 0,
    errors: 0,
    rateLimited: false,
    errorSamples: [] as { id: string; company: string; error: string }[],
  };

  await mapWithConcurrency(ids, 3, async (id) => {
    if (syncResult.rateLimited) return;

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
        if (isDocuSignRateLimitError(new Error(sync.error))) syncResult.rateLimited = true;
        if (syncResult.errorSamples.length < 15) {
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
        `  [${event.product_key}] ${contract.exhibitor_company_name}: ${sync.fromStatus} → ${sync.toStatus}`,
      );
    } catch (err) {
      syncResult.errors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      if (isDocuSignRateLimitError(err instanceof Error ? err : new Error(msg))) {
        syncResult.rateLimited = true;
      }
      if (syncResult.errorSamples.length < 15) {
        syncResult.errorSamples.push({
          id: contract.id,
          company: contract.exhibitor_company_name,
          error: msg,
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
    .limit(200);

  let released = 0;
  let releaseFailed = 0;
  for (const row of signedStuck ?? []) {
    const event = eventById.get(row.event_id as string);
    if (!event) continue;
    const release = await autoReleaseAfterFullySigned({
      supabase,
      contract: row,
      event,
      actorEmail: 'system@sync-all-inflight-docusign',
      auditAction: 'auto_release_accounting',
    });
    if (release.ok) {
      released += 1;
      console.log(`  released → executed: ${row.exhibitor_company_name}`);
    } else {
      releaseFailed += 1;
      console.log(`  release failed: ${row.exhibitor_company_name}: ${release.error}`);
    }
  }

  console.log('\nSync result:', syncResult);
  console.log({ released, releaseFailed, signedCandidates: signedStuck?.length ?? 0 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
