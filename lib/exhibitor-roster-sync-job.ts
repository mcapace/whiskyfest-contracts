import {
  fetchExhibitorRoster,
  hydrateRosterRowsWithContracts,
  recalledContractIds,
  rosterRowKey,
  type ExhibitorRosterRow,
  type ExhibitorRosterSheetConfig,
  rosterSheetsFromEvent,
} from '@/lib/exhibitor-roster';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { syncLinkedContractsFromRosterRows } from '@/lib/nywe-roster-contract-sync';
import {
  formatRosterPullWaitMessage,
  isGoogleSheetsQuotaError,
  liveRosterPullAllowed,
  markLiveRosterPullFinished,
  msUntilNextLiveRosterPull,
  tryBeginLiveRosterPull,
} from '@/lib/roster-sheets-pull-policy';
import { getActiveWineSpectatorEvent } from '@/lib/wine-spectator-event';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ContractWithTotals, Event } from '@/types/db';

/** Slightly longer than the 30-minute cron interval. */
export const ROSTER_CACHE_MAX_AGE_MS = 35 * 60 * 1000;

export type ExhibitorRosterPayload = {
  syncedAt: string;
  sheets: ExhibitorRosterSheetConfig[];
  rows: ExhibitorRosterRow[];
};

export type ExhibitorRosterSyncResult =
  | {
      status: 'synced';
      eventId: string;
      eventName: string;
      syncedAt: string;
      rowCount: number;
      writebackCount: number;
      contractsUpdated: number;
    }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; error: string };

type CachedSnapshot = {
  syncedAt?: string;
  sheets?: ExhibitorRosterSheetConfig[];
  rows?: ExhibitorRosterRow[];
};

function parseCachedSnapshot(raw: unknown): ExhibitorRosterPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const snap = raw as CachedSnapshot;
  if (!snap.syncedAt || !Array.isArray(snap.rows) || !Array.isArray(snap.sheets)) return null;
  return {
    syncedAt: snap.syncedAt,
    sheets: snap.sheets,
    rows: snap.rows,
  };
}

function rosterSheetConfigFingerprint(configs: ExhibitorRosterSheetConfig[]): string {
  return configs
    .map((s) => `${s.key}|${s.spreadsheet_id}|${s.tab}`)
    .sort()
    .join(';');
}

function rosterCacheValidForEvent(event: Event, cached: ExhibitorRosterPayload): boolean {
  const current = rosterSheetsFromEvent(event);
  if (current.length === 0) return false;
  if (current.length !== cached.sheets.length) return false;
  return rosterSheetConfigFingerprint(current) === rosterSheetConfigFingerprint(cached.sheets);
}

export function rosterFromEventCache(event: Event): ExhibitorRosterPayload | null {
  if (!event.roster_last_synced_at || !event.roster_cached_snapshot) return null;
  const age = Date.now() - new Date(event.roster_last_synced_at).getTime();
  if (age > ROSTER_CACHE_MAX_AGE_MS) return null;
  const cached = parseCachedSnapshot(event.roster_cached_snapshot);
  if (!cached) return null;
  if (!rosterCacheValidForEvent(event, cached)) return null;
  return cached;
}

/** Last good snapshot — used when a live Google Sheets pull fails. */
export function rosterStaleFromEventCache(event: Event): ExhibitorRosterPayload | null {
  if (!event.roster_cached_snapshot) return null;
  return parseCachedSnapshot(event.roster_cached_snapshot);
}

async function persistRosterSnapshot(eventId: string, roster: ExhibitorRosterPayload): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('events')
    .update({
      roster_last_synced_at: roster.syncedAt,
      roster_cached_snapshot: roster,
    })
    .eq('id', eventId);
  if (error) throw new Error(error.message);
}

async function writebackLinkedContracts(eventId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data: contracts } = await supabase
    .from('contracts_with_totals')
    .select('id, status, source_sheet_id, source_sheet_tab, source_row_number, updated_at, event_id, sent_at, exhibitor_company_name, exhibitor_legal_name')
    .eq('event_id', eventId)
    .not('source_sheet_id', 'is', null);

  const recalledIds = await recalledContractIds(
    eventId,
    ((contracts ?? []) as ContractWithTotals[])
      .filter((c) => c.status === 'draft' && !c.sent_at)
      .map((c) => c.id),
  );

  let count = 0;
  for (const contract of (contracts ?? []) as ContractWithTotals[]) {
    if (!contract.source_sheet_id || !contract.source_sheet_tab || !contract.source_row_number) continue;
    const rowKey = rosterRowKey(contract.source_sheet_id, contract.source_sheet_tab, contract.source_row_number);
    const recalled = recalledIds.has(contract.id);

    await syncExhibitorRosterWriteback(
      contract,
      recalled ? { statusLabel: 'Recalled' } : undefined,
    );
    count += 1;
  }
  return count;
}

/** Pull master Google Sheets roster, reconcile write-back, and cache in Supabase. */
export async function syncExhibitorRosterMaster(event?: Event | null): Promise<ExhibitorRosterSyncResult> {
  const activeEvent = event ?? (await getActiveWineSpectatorEvent());
  if (!activeEvent) {
    return { status: 'skipped', reason: 'No active Wine Spectator event.' };
  }
  if (rosterSheetsFromEvent(activeEvent).length === 0) {
    return { status: 'skipped', reason: 'No exhibitor roster sheets configured for this event.' };
  }

  try {
    const roster = await fetchExhibitorRoster(activeEvent);
    const contractsUpdated = await syncLinkedContractsFromRosterRows(activeEvent.id, roster.rows);
    const writebackCount = await writebackLinkedContracts(activeEvent.id);
    const payload: ExhibitorRosterPayload = {
      syncedAt: roster.syncedAt,
      sheets: roster.sheets,
      rows: roster.rows,
    };
    const sheetLoadFailed = roster.warnings.some((w) => w.includes('could not load'));
    if (!sheetLoadFailed) {
      await persistRosterSnapshot(activeEvent.id, payload);
    }

    return {
      status: 'synced',
      eventId: activeEvent.id,
      eventName: activeEvent.name,
      syncedAt: payload.syncedAt,
      rowCount: payload.rows.length,
      writebackCount,
      contractsUpdated,
    };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Exhibitor roster sync failed',
    };
  }
}

export type LoadExhibitorRosterResult = {
  roster: ExhibitorRosterPayload;
  fromCache: boolean;
  /** Live pull failed; showing last cached snapshot. */
  stale?: boolean;
  /** Manual refresh temporarily blocked to protect API quota. */
  rateLimited?: boolean;
  fetchError?: string;
  warnings?: string[];
};

async function withLiveContractStatus(event: Event, roster: ExhibitorRosterPayload): Promise<ExhibitorRosterPayload> {
  return {
    ...roster,
    rows: await hydrateRosterRowsWithContracts(event.id, roster.rows),
  };
}

/** Load roster for SSR/pages — never block on a live Google Sheets pull. */
export async function loadExhibitorRosterForPage(event: Event): Promise<LoadExhibitorRosterResult> {
  if (rosterSheetsFromEvent(event).length === 0) {
    throw new Error('No exhibitor roster sheets configured for this event. Check Event settings in Supabase.');
  }

  const cached = rosterFromEventCache(event);
  if (cached) {
    return { roster: await withLiveContractStatus(event, cached), fromCache: true };
  }

  const stale = rosterStaleFromEventCache(event);
  if (stale) {
    return {
      roster: await withLiveContractStatus(event, stale),
      fromCache: true,
      stale: true,
      fetchError: 'Showing last synced roster. Use Refresh from sheets for the latest.',
    };
  }

  return {
    roster: {
      syncedAt: new Date().toISOString(),
      sheets: rosterSheetsFromEvent(event),
      rows: [],
    },
    fromCache: false,
    stale: true,
    fetchError: 'Roster is loading from Google Sheets. Data will appear shortly — or click Refresh from sheets.',
  };
}

/** Load roster for UI: cached snapshot when fresh, otherwise live pull (and cache). */
export async function loadExhibitorRoster(
  event: Event,
  options?: { forceLive?: boolean },
): Promise<LoadExhibitorRosterResult> {
  const supabase = getSupabaseAdmin();
  let activeEvent = event;

  if (options?.forceLive) {
    const { data: freshEvent } = await supabase.from('events').select('*').eq('id', event.id).maybeSingle<Event>();
    activeEvent = freshEvent ?? event;

    if (!liveRosterPullAllowed(activeEvent)) {
      const cached = rosterFromEventCache(activeEvent) ?? rosterStaleFromEventCache(activeEvent);
      const waitMsg = formatRosterPullWaitMessage(msUntilNextLiveRosterPull(activeEvent));
      if (cached) {
        return {
          roster: await withLiveContractStatus(activeEvent, cached),
          fromCache: true,
          stale: false,
          rateLimited: true,
          fetchError: `Manual refresh available ${waitMsg.replace('Try again ', '')}`,
        };
      }
    }
  }

  if (!options?.forceLive) {
    const cached = rosterFromEventCache(activeEvent);
    if (cached) {
      return { roster: await withLiveContractStatus(activeEvent, cached), fromCache: true };
    }
    const stale = rosterStaleFromEventCache(activeEvent);
    if (stale) {
      return {
        roster: await withLiveContractStatus(activeEvent, stale),
        fromCache: true,
        stale: true,
        fetchError: 'Showing last synced roster. Use Refresh from sheets when you need the latest.',
      };
    }
  }

  if (rosterSheetsFromEvent(activeEvent).length === 0) {
    throw new Error('No exhibitor roster sheets configured for this event. Check Event settings in Supabase.');
  }

  if (options?.forceLive) {
    const claimed = await tryBeginLiveRosterPull(activeEvent.id);
    if (!claimed) {
      const { data: freshEvent } = await supabase.from('events').select('*').eq('id', activeEvent.id).maybeSingle<Event>();
      const ev = freshEvent ?? activeEvent;
      const cached = rosterFromEventCache(ev) ?? rosterStaleFromEventCache(ev);
      const waitMsg = formatRosterPullWaitMessage(msUntilNextLiveRosterPull(ev));
      if (cached) {
        return {
          roster: await withLiveContractStatus(ev, cached),
          fromCache: true,
          stale: false,
          rateLimited: true,
          fetchError: `Another refresh just ran. ${waitMsg}`,
        };
      }
    }
  }

  try {
    const roster = await fetchExhibitorRoster(activeEvent);
    const payload: ExhibitorRosterPayload = {
      syncedAt: roster.syncedAt,
      sheets: roster.sheets,
      rows: roster.rows,
    };
    const sheetLoadFailed = roster.warnings.some((w) => w.includes('could not load'));
    const quotaHit = roster.warnings.some((w) => isGoogleSheetsQuotaError(w));
    if (!sheetLoadFailed) {
      await persistRosterSnapshot(activeEvent.id, payload);
      await syncLinkedContractsFromRosterRows(activeEvent.id, payload.rows);
    } else if (options?.forceLive) {
      const stale = rosterStaleFromEventCache(activeEvent);
      if (stale) {
        const summary = roster.warnings.join(' · ');
        console.warn('[loadExhibitorRoster] live pull partial/failed — serving stale cache', summary);
        return {
          roster: await withLiveContractStatus(activeEvent, stale),
          fromCache: true,
          stale: true,
          fetchError: quotaHit
            ? `Google Sheets read quota exceeded. Wait 2–3 minutes, then click Refresh from sheets. (${summary})`
            : summary,
          warnings: roster.warnings.length ? roster.warnings : undefined,
        };
      }
      console.warn('[loadExhibitorRoster] skipped cache persist — one or more sheets failed to load');
    } else {
      console.warn('[loadExhibitorRoster] skipped cache persist — one or more sheets failed to load');
    }
    return {
      roster: await withLiveContractStatus(activeEvent, payload),
      fromCache: false,
      warnings: roster.warnings.length ? roster.warnings : undefined,
    };
  } catch (err) {
    if (options?.forceLive) {
      await markLiveRosterPullFinished(activeEvent.id);
    }
    const stale = rosterStaleFromEventCache(activeEvent);
    const message = err instanceof Error ? err.message : 'Exhibitor roster sync failed';
    const quota = isGoogleSheetsQuotaError(message);
    if (stale) {
      console.error('[loadExhibitorRoster] live pull failed — serving stale cache', message);
      return {
        roster: await withLiveContractStatus(activeEvent, stale),
        fromCache: true,
        stale: true,
        fetchError: quota
          ? `Google Sheets read quota exceeded. Showing last synced roster. Wait 2–3 minutes, then click Refresh from sheets.`
          : message,
      };
    }
    throw err instanceof Error ? err : new Error(message);
  }
}
