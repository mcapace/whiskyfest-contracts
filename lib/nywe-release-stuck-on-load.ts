import { getSupabaseAdmin } from '@/lib/supabase';
import { autoReleaseAfterFullySigned } from '@/lib/auto-release-accounting';
import type { ContractWithTotals, Event } from '@/types/db';

export type SignedAccountingReleaseResult = {
  scanned: number;
  released: number;
  failed: number;
  errorSamples: { id: string; company: string; error: string }[];
};

/** Release fully signed contracts (WhiskyFest + NYWE) that have not reached accounting yet. */
export async function releaseSignedContractsToAccounting(options?: {
  limit?: number;
}): Promise<SignedAccountingReleaseResult> {
  const supabase = getSupabaseAdmin();
  const empty: SignedAccountingReleaseResult = {
    scanned: 0,
    released: 0,
    failed: 0,
    errorSamples: [],
  };

  const { data: activeEvents } = await supabase.from('events').select('*').eq('is_active', true);
  const eventIds = (activeEvents ?? []).map((e) => e.id as string);
  if (eventIds.length === 0) return empty;

  const eventById = new Map<string, Event>(((activeEvents ?? []) as Event[]).map((e) => [e.id, e]));

  const { data: stuck } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .in('event_id', eventIds)
    .eq('status', 'signed')
    .is('executed_at', null)
    .limit(options?.limit ?? 100);

  const result = { ...empty, scanned: stuck?.length ?? 0 };

  for (const row of (stuck ?? []) as ContractWithTotals[]) {
    const event = eventById.get(row.event_id);
    if (!event) continue;

    const release = await autoReleaseAfterFullySigned({
      supabase,
      contractId: row.id,
      event,
      countersignerEmail: row.countersigned_by_email,
    });
    if (release.released) {
      result.released += 1;
    } else if (release.error) {
      result.failed += 1;
      if (result.errorSamples.length < 8) {
        result.errorSamples.push({
          id: row.id,
          company: row.exhibitor_company_name,
          error: release.error,
        });
      }
    }
  }

  return result;
}

/** @deprecated Use releaseSignedContractsToAccounting */
export async function releaseNyweSignedLicensesToAccounting(options?: {
  limit?: number;
}): Promise<SignedAccountingReleaseResult> {
  return releaseSignedContractsToAccounting(options);
}

export async function releaseStuckNyweSignedLicenses(): Promise<number> {
  const result = await releaseSignedContractsToAccounting({ limit: 40 });
  return result.released;
}
