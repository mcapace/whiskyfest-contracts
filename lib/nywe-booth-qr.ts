import { getSupabaseAdmin } from '@/lib/supabase';
import {
  assertRebrandlyBrandedShortUrl,
  createRebrandlyLink,
  downloadRebrandlyQr,
  getRebrandlyLink,
  updateRebrandlyDestination,
  type RebrandlyQrFormat,
} from '@/lib/rebrandly';
import { nyweBoothQrDownloadFilename } from '@/lib/nywe-art-codes';
import { nywePortalOrigin } from '@/lib/portal-host';
import { normalizeWineryWebsiteUrl, rosterWineryWebsiteUrl } from '@/lib/winery-website';
import { isNyweVendorOnlyEvent } from '@/lib/nywe-pricing';
import { rosterStaleFromEventCache } from '@/lib/exhibitor-roster-sync-job';
import { normalizeSheetContractId } from '@/lib/nywe-roster-identity';
import type { Contract, Event } from '@/types/db';

const CLICK_REFRESH_MAX = 40;
const CLICK_STALE_MS = 15 * 60 * 1000;

export type NyweBoothQrContractRow = Pick<
  Contract,
  | 'id'
  | 'event_id'
  | 'status'
  | 'order_type'
  | 'exhibitor_company_name'
  | 'exhibitor_website_url'
  | 'rebrandly_link_id'
  | 'rebrandly_short_url'
  | 'qr_clicks'
  | 'qr_last_click_at'
  | 'art_code'
  | 'booth_number'
>;

const BOOTH_QR_CONTRACT_COLUMNS =
  'id, event_id, status, order_type, exhibitor_company_name, exhibitor_website_url, rebrandly_link_id, rebrandly_short_url, qr_clicks, qr_last_click_at, art_code, booth_number';

export function nyweBoothQrEligible(
  contract: Pick<Contract, 'status' | 'order_type'>,
): boolean {
  return contract.status === 'executed' && contract.order_type !== 'sponsorship_only';
}

/** Executed NYWE vendor licenses for booth signs — not drafts, not sponsorship-only. */
export async function listNyweExecutedBoothQrContracts(eventId: string): Promise<NyweBoothQrContractRow[]> {
  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const rows: NyweBoothQrContractRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('contracts')
      .select(BOOTH_QR_CONTRACT_COLUMNS)
      .eq('event_id', eventId)
      .eq('status', 'executed')
      .order('exhibitor_company_name', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as NyweBoothQrContractRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows.filter(nyweBoothQrEligible);
}

export function nyweBoothQrTrackingPath(contractId: string): string {
  return `/b/${contractId}`;
}

/** Rebrandly destination we control so the conversion SDK can run, then redirect to the winery. */
export function nyweBoothQrTrackingUrl(contractId: string): string {
  return `${nywePortalOrigin()}${nyweBoothQrTrackingPath(contractId)}`;
}

export function rebrandlyConversionApiKey(): string | null {
  return process.env['REBRANDLY_CONVERSION_API_KEY']?.trim() || null;
}

function sameDestination(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    const path = (url: URL) => url.pathname.replace(/\/$/, '') || '/';
    return left.origin === right.origin && path(left) === path(right);
  } catch {
    return a.replace(/\/$/, '') === b.replace(/\/$/, '');
  }
}

async function ensureTrackingDestination(linkId: string, contractId: string): Promise<void> {
  const tracking = nyweBoothQrTrackingUrl(contractId);
  const existing = await getRebrandlyLink(linkId);
  if (!sameDestination(existing.destination, tracking)) {
    await updateRebrandlyDestination(linkId, tracking);
  }
}

export async function loadNyweBoothQrRedirect(contractId: string): Promise<{
  wineryName: string;
  websiteUrl: string;
} | null> {
  const supabase = getSupabaseAdmin();
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, exhibitor_company_name, exhibitor_website_url, event_id')
    .eq('id', contractId)
    .maybeSingle<
      Pick<Contract, 'id' | 'exhibitor_company_name' | 'exhibitor_website_url' | 'event_id'>
    >();
  if (error || !contract) return null;

  const { data: event } = await supabase
    .from('events')
    .select('contract_template_profile')
    .eq('id', contract.event_id)
    .maybeSingle<Pick<Event, 'contract_template_profile'>>();
  if (!isNyweVendorOnlyEvent(event)) return null;

  const websiteUrl = normalizeWineryWebsiteUrl(contract.exhibitor_website_url);
  if (!websiteUrl) return null;
  return { wineryName: contract.exhibitor_company_name, websiteUrl };
}

export function boothQrSlashtag(wineryName: string, year: number, attempt = 0): string {
  const base = wineryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28) || 'winery';
  const prefix = `nywe${String(year).slice(-2)}-`;
  const suffix = attempt > 0 ? `-${attempt + 1}` : '';
  return `${prefix}${base}${suffix}`.slice(0, 40);
}

function downloadFilename(
  contract: Pick<NyweBoothQrContractRow, 'exhibitor_company_name' | 'art_code'>,
  format: RebrandlyQrFormat,
): string {
  return nyweBoothQrDownloadFilename({
    artCode: contract.art_code,
    wineryName: contract.exhibitor_company_name,
    format,
  });
}

async function persistLink(
  contractId: string,
  fields: {
    exhibitor_website_url?: string | null;
    rebrandly_link_id?: string;
    rebrandly_short_url?: string;
    qr_clicks?: number;
    qr_last_click_at?: string | null;
    qr_clicks_synced_at?: string;
  },
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('contracts').update(fields).eq('id', contractId);
  if (error) throw new Error(error.message);
}

export async function saveNyweWebsiteUrl(contract: Contract, rawUrl: string): Promise<string> {
  const url = normalizeWineryWebsiteUrl(rawUrl);
  if (!url) throw new Error('Enter a valid winery website (for example https://thecallingwine.com).');

  if (contract.rebrandly_link_id) {
    await ensureTrackingDestination(contract.rebrandly_link_id, contract.id);
  }

  await persistLink(contract.id, { exhibitor_website_url: url });
  return url;
}

export function parseBoothQrFormat(raw: string | null | undefined): RebrandlyQrFormat {
  const value = (raw ?? 'png').trim().toLowerCase();
  if (value === 'png' || value === 'svg') return value;
  throw new Error('Booth QR format must be png or svg.');
}

export async function ensureNyweBoothQrLink(
  contract: NyweBoothQrContractRow,
  eventYear: number,
  options?: { forceSync?: boolean },
): Promise<{ shortUrl: string }> {
  const website = normalizeWineryWebsiteUrl(contract.exhibitor_website_url);
  if (!website) {
    throw new Error('Add a winery website before printing the booth QR.');
  }

  if (!options?.forceSync && contract.rebrandly_short_url?.trim()) {
    return { shortUrl: assertRebrandlyBrandedShortUrl(contract.rebrandly_short_url) };
  }

  const destination = nyweBoothQrTrackingUrl(contract.id);

  let linkId = contract.rebrandly_link_id?.trim() || null;
  let shortUrl = contract.rebrandly_short_url?.trim() || null;

  if (linkId) {
    const existing = await getRebrandlyLink(linkId);
    shortUrl = assertRebrandlyBrandedShortUrl(existing.shortUrl);
    if (!sameDestination(existing.destination, destination)) {
      await updateRebrandlyDestination(linkId, destination);
    }
    await persistLink(contract.id, {
      exhibitor_website_url: website,
      rebrandly_link_id: existing.id,
      rebrandly_short_url: shortUrl,
      qr_clicks: existing.clicks ?? contract.qr_clicks ?? 0,
      qr_last_click_at: existing.lastClickAt ?? contract.qr_last_click_at,
      qr_clicks_synced_at: new Date().toISOString(),
    });
  } else {
    let created = null as Awaited<ReturnType<typeof createRebrandlyLink>> | null;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        created = await createRebrandlyLink({
          destination,
          slashtag: boothQrSlashtag(contract.exhibitor_company_name, eventYear, attempt),
          title: `NYWE ${eventYear} · ${contract.exhibitor_company_name}`,
        });
        break;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 403 || status === 409) continue;
        throw err;
      }
    }
    if (!created) throw new Error('Could not create a Rebrandly short link (slashtag in use). Try again.');
    linkId = created.id;
    shortUrl = assertRebrandlyBrandedShortUrl(created.shortUrl);
    await persistLink(contract.id, {
      exhibitor_website_url: website,
      rebrandly_link_id: created.id,
      rebrandly_short_url: shortUrl,
      qr_clicks: created.clicks ?? 0,
      qr_last_click_at: created.lastClickAt ?? null,
      qr_clicks_synced_at: new Date().toISOString(),
    });
  }

  if (!shortUrl) throw new Error('Rebrandly did not return a short URL.');
  return { shortUrl: assertRebrandlyBrandedShortUrl(shortUrl) };
}

export async function downloadNyweBoothQr(
  contract: NyweBoothQrContractRow,
  eventYear: number,
  format: RebrandlyQrFormat,
): Promise<{ body: Buffer; filename: string; contentType: string; shortUrl: string }> {
  const { shortUrl } = await ensureNyweBoothQrLink(contract, eventYear);
  const body = await downloadRebrandlyQr(shortUrl, format);
  return {
    body,
    shortUrl,
    filename: downloadFilename(contract, format),
    contentType: format === 'svg' ? 'image/svg+xml' : 'image/png',
  };
}

export async function refreshNyweQrClicks(eventId: string): Promise<number> {
  if (!process.env['REBRANDLY_API_KEY']?.trim()) return 0;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('contracts')
    .select('id, rebrandly_link_id, qr_clicks, qr_last_click_at, qr_clicks_synced_at')
    .eq('event_id', eventId)
    .not('rebrandly_link_id', 'is', null)
    .eq('status', 'executed')
    .neq('order_type', 'sponsorship_only');

  if (error) {
    console.error('[nywe-booth-qr] click refresh lookup failed', error.message);
    return 0;
  }

  const staleBefore = Date.now() - CLICK_STALE_MS;
  const rows = (data ?? []).filter((row) => {
    if (!row.rebrandly_link_id) return false;
    if (!row.qr_clicks_synced_at) return true;
    return Date.parse(row.qr_clicks_synced_at) < staleBefore;
  }).slice(0, CLICK_REFRESH_MAX);

  let updated = 0;
  for (const row of rows) {
    try {
      const link = await getRebrandlyLink(row.rebrandly_link_id as string);
      const { error: updError } = await supabase
        .from('contracts')
        .update({
          qr_clicks: link.clicks ?? 0,
          qr_last_click_at: link.lastClickAt ?? null,
          qr_clicks_synced_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (!updError) updated += 1;
    } catch (err) {
      console.warn('[nywe-booth-qr] click refresh failed', row.id, err instanceof Error ? err.message : err);
    }
  }
  return updated;
}

const LINK_CREATE_BATCH = 30;

/** Copy winery websites from the cached NYWE roster onto executed licenses that are missing one. */
export async function backfillNyweWebsitesFromRoster(event: Event): Promise<number> {
  const cached = rosterStaleFromEventCache(event);
  if (!cached) return 0;
  const contracts = await listNyweExecutedBoothQrContracts(event.id);
  const byId = new Map(contracts.map((row) => [row.id.toLowerCase(), row]));
  let updated = 0;
  for (const row of cached.rows) {
    const id = normalizeSheetContractId(row.contractId) || normalizeSheetContractId(row.sheetContractId);
    if (!id) continue;
    const contract = byId.get(id);
    if (!contract || normalizeWineryWebsiteUrl(contract.exhibitor_website_url)) continue;
    const url = rosterWineryWebsiteUrl(row);
    if (!url) continue;
    await persistLink(contract.id, { exhibitor_website_url: url });
    contract.exhibitor_website_url = url;
    updated += 1;
  }
  return updated;
}

/** Create winespectator.live short links for executed licenses that have a website but no Rebrandly URL yet. */
export async function ensureMissingNyweBoothQrLinks(
  eventId: string,
  eventYear: number,
  limit = LINK_CREATE_BATCH,
): Promise<{ created: number; remaining: number; errors: string[] }> {
  const contracts = await listNyweExecutedBoothQrContracts(eventId);
  const missing = contracts.filter(
    (row) => normalizeWineryWebsiteUrl(row.exhibitor_website_url) && !row.rebrandly_short_url?.trim(),
  );
  const batch = missing.slice(0, limit);
  let created = 0;
  const errors: string[] = [];
  for (const contract of batch) {
    try {
      await ensureNyweBoothQrLink(contract, eventYear);
      created += 1;
    } catch (err) {
      errors.push(
        `${contract.exhibitor_company_name}: ${err instanceof Error ? err.message : 'could not create short link'}`,
      );
    }
  }
  return { created, remaining: Math.max(0, missing.length - created), errors };
}
