type RebrandlyDomain = { id?: string; fullName?: string };

export type RebrandlyLink = {
  id: string;
  title?: string;
  slashtag?: string;
  destination: string;
  shortUrl: string;
  clicks?: number;
  lastClickAt?: string | null;
  domain?: RebrandlyDomain;
};

function apiKey(): string {
  const key = process.env['REBRANDLY_API_KEY']?.trim();
  if (!key) throw new Error('REBRANDLY_API_KEY is not set.');
  return key;
}

function domainPayload(): RebrandlyDomain {
  const fullName = rebrandlyBrandedDomain();
  const id = process.env['REBRANDLY_DOMAIN_ID']?.trim();
  return id ? { id, fullName } : { fullName };
}

/** Branded host encoded in every NYWE booth QR (never rebrand.ly). */
export function rebrandlyBrandedDomain(): string {
  return process.env['REBRANDLY_DOMAIN']?.trim() || 'winespectator.live';
}

export function assertRebrandlyBrandedShortUrl(shortUrl: string): string {
  const trimmed = shortUrl.trim().replace(/\/$/, '');
  const host = trimmed.replace(/^https?:\/\//i, '').split('/')[0]?.toLowerCase() ?? '';
  const expected = rebrandlyBrandedDomain().toLowerCase();
  if (host !== expected) {
    throw new Error(
      `Booth QR must use ${expected} (got ${host || trimmed}). Check REBRANDLY_DOMAIN and REBRANDLY_DOMAIN_ID.`,
    );
  }
  return trimmed;
}

function workspaceHeaders(): Record<string, string> {
  const workspace = process.env['REBRANDLY_WORKSPACE_ID']?.trim();
  return workspace ? { workspace } : {};
}

async function rebrandlyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.rebrandly.com/v1${path}`, {
    ...init,
    headers: {
      apikey: apiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...workspaceHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      (json && typeof json === 'object' && 'message' in json && typeof (json as { message: unknown }).message === 'string'
        ? (json as { message: string }).message
        : null) ||
      `Rebrandly ${res.status}`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}

export async function createRebrandlyLink(input: {
  destination: string;
  slashtag: string;
  title: string;
}): Promise<RebrandlyLink> {
  return rebrandlyFetch<RebrandlyLink>('/links', {
    method: 'POST',
    body: JSON.stringify({
      destination: input.destination,
      slashtag: input.slashtag,
      title: input.title.slice(0, 255),
      domain: domainPayload(),
    }),
  });
}

export async function updateRebrandlyDestination(linkId: string, destination: string): Promise<RebrandlyLink> {
  return rebrandlyFetch<RebrandlyLink>(`/links/${encodeURIComponent(linkId)}`, {
    method: 'POST',
    body: JSON.stringify({ destination }),
  });
}

export async function getRebrandlyLink(linkId: string): Promise<RebrandlyLink> {
  return rebrandlyFetch<RebrandlyLink>(`/links/${encodeURIComponent(linkId)}`);
}

export type RebrandlyQrFormat = 'png' | 'svg';

export function rebrandlyQrImageUrl(shortUrl: string, format: RebrandlyQrFormat, size = 1024): string {
  const branded = assertRebrandlyBrandedShortUrl(shortUrl);
  const hostPath = branded.replace(/^https?:\/\//i, '');
  if (format === 'svg') return `https://${hostPath}.qr?type=svg`;
  return `https://${hostPath}.qr?size=${size}`;
}

export async function downloadRebrandlyQr(shortUrl: string, format: RebrandlyQrFormat): Promise<Buffer> {
  const res = await fetch(rebrandlyQrImageUrl(shortUrl, format), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not download QR ${format.toUpperCase()} (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}
