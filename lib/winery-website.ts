/** Known URL corrections for NYWE winery websites (QR code destinations). */
const WINERY_URL_CORRECTIONS: Record<string, string> = {
  // Official URLs from Susannah Nolan (Sept 16, 2026)
  // Wilson Daniels importer pages for Gaja estates
  'camarcanda': 'https://wilsondaniels.com/wine/ca-marcanda/camarcanda-bolgheri-dop/',
  'gaja': 'https://wilsondaniels.com/winery/gaja/',
  'pieve': 'https://wilsondaniels.com/winery/pieve-santa-restituta/',
  'pievesantarestituta': 'https://wilsondaniels.com/winery/pieve-santa-restituta/',
  // Winery sites with English versions
  'ramospinto': 'https://www.ramospinto.pt/en/',
  'merumpriorati': 'http://merumpriorati.com/en/',
  'pereventrura': 'http://merumpriorati.com/en/',
  'ventrura': 'http://merumpriorati.com/en/',
  'coldorcia': 'https://coldorcia.it/en/home',
  'brancaia': 'https://brancaia.com/en/',
  'cvne': 'https://cvne.com/en/',
  // Sites without www
  'www.tensleywines': 'https://tensleywines.com/',
  // Importer pages
  'paoloscavino': 'https://www.skurnik.com/producer/paolo-scavino/',
  'scavino': 'https://www.skurnik.com/producer/paolo-scavino/',
  // Note: Beronia site is completely down per Susannah
};

/** Normalize a roster/staff-entered winery website (booth QR redirect target). */
export function normalizeWineryWebsiteUrl(raw: string | null | undefined): string | null {
  const extracted = extractHttpUrl(raw);
  if (!extracted) return null;
  let value = extracted;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;
  
  // Apply known corrections before normalizing
  const lowerValue = value.toLowerCase();
  for (const [pattern, corrected] of Object.entries(WINERY_URL_CORRECTIONS)) {
    if (lowerValue.includes(pattern)) {
      value = corrected;
      break;
    }
  }
  
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
