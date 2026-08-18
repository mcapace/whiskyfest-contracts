import { getSupabaseAdmin } from '@/lib/supabase';
import {
  createRebrandlyLink,
  downloadRebrandlyQrPng,
  getRebrandlyLink,
  updateRebrandlyDestination,
} from '@/lib/rebrandly';
import { normalizeWineryWebsiteUrl } from '@/lib/winery-website';
import type { Contract } from '@/types/db';

const CLICK_REFRESH_MAX = 40;
const CLICK_STALE_MS = 15 * 60 * 1000;

export function nyweBoothQrEligible(
  contract: Pick<Contract, 'status' | 'order_type'>,
): boolean {
  return contract.status === 'executed' && contract.order_type !== 'sponsorship_only';
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

function downloadFilename(wineryName: string): string {
  const safe = wineryName.replace(/[^\w]+/g, ' ').trim() || 'Winery';
  return `${safe} NYWE booth QR.png`;
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

  if (contract.rebrandly_link_id && url !== contract.exhibitor_website_url) {
    await updateRebrandlyDestination(contract.rebrandly_link_id, url);
  }

  await persistLink(contract.id, { exhibitor_website_url: url });
  return url;
}

export async function ensureNyweBoothQrLink(
  contract: Contract,
  eventYear: number,
): Promise<{ shortUrl: string; png: Buffer; filename: string }> {
  const destination = normalizeWineryWebsiteUrl(contract.exhibitor_website_url);
  if (!destination) {
    throw new Error('Add a winery website before printing the booth QR.');
  }

  let linkId = contract.rebrandly_link_id?.trim() || null;
  let shortUrl = contract.rebrandly_short_url?.trim() || null;

  if (linkId) {
    const existing = await getRebrandlyLink(linkId);
    shortUrl = existing.shortUrl;
    if (existing.destination !== destination) {
      await updateRebrandlyDestination(linkId, destination);
    }
    await persistLink(contract.id, {
      exhibitor_website_url: destination,
      rebrandly_link_id: existing.id,
      rebrandly_short_url: existing.shortUrl,
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
    shortUrl = created.shortUrl;
    await persistLink(contract.id, {
      exhibitor_website_url: destination,
      rebrandly_link_id: created.id,
      rebrandly_short_url: created.shortUrl,
      qr_clicks: created.clicks ?? 0,
      qr_last_click_at: created.lastClickAt ?? null,
      qr_clicks_synced_at: new Date().toISOString(),
    });
  }

  if (!shortUrl) throw new Error('Rebrandly did not return a short URL.');
  const png = await downloadRebrandlyQrPng(shortUrl);
  return { shortUrl, png, filename: downloadFilename(contract.exhibitor_company_name) };
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
