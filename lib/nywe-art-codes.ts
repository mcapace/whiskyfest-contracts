/** Helpers for NYWE print art codes (booth QR file naming). */

const STOP_WORDS = new Set([
  'the',
  'de',
  'di',
  'du',
  'da',
  'del',
  'della',
  'des',
  'la',
  'le',
  'les',
  'el',
  'y',
  'and',
  'estate',
  'estates',
  'vineyard',
  'vineyards',
  'winery',
  'wineries',
  'cellar',
  'cellars',
  'bodega',
  'bodegas',
  'domaine',
  'domaines',
  'chateau',
  'family',
  'srl',
  'sa',
  'inc',
  'llc',
  'ltd',
  'co',
  'company',
  'vintners',
  'wines',
  'wine',
  'vinhos',
  'vinos',
]);

export function normalizeNyweWineryKey(name: string): string {
  return tokenizeNyweWinery(name).join(' ');
}

export function tokenizeNyweWinery(name: string): string[] {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOP_WORDS.has(t));
}

export function scoreNyweWineryMatch(sheetName: string, contractName: string): number {
  const sk = normalizeNyweWineryKey(sheetName);
  const ck = normalizeNyweWineryKey(contractName);
  if (!sk || !ck) return 0;
  if (sk === ck) return 100;

  const st = tokenizeNyweWinery(sheetName);
  const ct = tokenizeNyweWinery(contractName);
  const inter = st.filter((t) => ct.includes(t));
  const union = new Set([...st, ...ct]);
  let score = (inter.length / Math.max(union.size, 1)) * 80;
  if (ck.startsWith(sk) || sk.startsWith(ck)) score += 15;
  if (ck.includes(sk) || sk.includes(ck)) score += 10;
  return score;
}

/** Prefer art code for print filenames; fall back to a safe winery stem. */
export function nyweBoothQrFileStem(input: {
  artCode?: string | null;
  wineryName: string;
}): string {
  const art = input.artCode?.trim();
  if (art) return art.replace(/[^\w.-]+/g, '');
  return input.wineryName.replace(/[^\w]+/g, ' ').trim() || 'Winery';
}

export function nyweBoothQrDownloadFilename(input: {
  artCode?: string | null;
  wineryName: string;
  format: 'png' | 'svg';
}): string {
  const stem = nyweBoothQrFileStem(input);
  if (input.artCode?.trim()) return `${stem}.${input.format}`;
  return `${stem} NYWE booth QR.${input.format}`;
}
