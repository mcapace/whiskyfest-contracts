/** Normalize a roster/staff-entered winery website (booth QR redirect target). */
export function normalizeWineryWebsiteUrl(raw: string | null | undefined): string | null {
  const extracted = extractHttpUrl(raw);
  if (!extracted) return null;
  let value = extracted;
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

function extractHttpUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const formula = value.match(/HYPERLINK\s*\(\s*"([^"]+)"/i);
  if (formula?.[1]) return formula[1].trim();
  const embedded = value.match(/https?:\/\/[^\s<>"']+/i);
  if (embedded?.[0]) return embedded[0].replace(/[),.;]+$/, '');
  const www = value.match(/\bwww\.[^\s<>"']+/i);
  if (www?.[0]) return www[0].replace(/[),.;]+$/, '');
  return value;
}

function isWebsiteSheetLabel(label: string): boolean {
  const text = label.trim();
  if (!/website/i.test(text)) return false;
  if (/email|importer|phone/i.test(text)) return false;
  return true;
}

export function rosterWineryWebsiteUrl(row: {
  contractWebsiteUrl?: string | null;
  wineryWebsite?: string | null;
  sheetFields?: { label: string; value: string }[];
}): string | null {
  const fromContract = normalizeWineryWebsiteUrl(row.contractWebsiteUrl);
  if (fromContract) return fromContract;
  const fromSheet = normalizeWineryWebsiteUrl(row.wineryWebsite);
  if (fromSheet) return fromSheet;
  for (const field of row.sheetFields ?? []) {
    if (!isWebsiteSheetLabel(field.label)) continue;
    const url = normalizeWineryWebsiteUrl(field.value);
    if (url) return url;
  }
  return null;
}
