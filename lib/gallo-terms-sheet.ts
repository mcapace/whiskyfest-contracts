import { readFileSync } from 'fs';
import { join } from 'path';

/** Wineries on the 2026 $70,000 Gallo order. Allegrini is not part of this deal. */
export const GALLO_TERMS_WINERIES = [
  'Jermann',
  'Louis M. Martini',
  'Massican',
  'Pahlmeyer',
  'Rombauer',
] as const;

const TERMS_SHEET_PDF = join(process.cwd(), 'assets/nywe-gallo-2026-terms.pdf');

/**
 * True only for Gallo's combined NYWE order. That contract is printed from the
 * older terms sheet instead of the vendor license. The sheet already contains
 * the mutual indemnification Lon Gallagher approved.
 */
export function galloUsesApprovedTermsSheet(mergeMap: Record<string, string>): boolean {
  const legal = (mergeMap['{{exhibitor_legal_name}}'] ?? '').trim().toLowerCase();
  const company = (mergeMap['{{exhibitor_company_name}}'] ?? '').trim().toLowerCase();
  const covered = (mergeMap['{{covered_wineries}}'] ?? '').trim();
  const isGallo = legal === 'gallo' || company === 'gallo' || company.startsWith('gallo (');
  if (!isGallo || !covered) return false;

  const names = covered
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const expected = GALLO_TERMS_WINERIES.map((name) => name.toLowerCase());
  if (names.length !== expected.length) return false;
  return expected.every((name) => names.includes(name));
}

export function readGalloTermsSheetPdf(): Buffer {
  return readFileSync(TERMS_SHEET_PDF);
}
