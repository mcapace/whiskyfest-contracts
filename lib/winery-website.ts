/** Normalize a roster/staff-entered winery website (booth QR redirect target). */
export function normalizeWineryWebsiteUrl(raw: string | null | undefined): string | null {
  let value = (raw ?? '').trim();
  if (!value) return null;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}
