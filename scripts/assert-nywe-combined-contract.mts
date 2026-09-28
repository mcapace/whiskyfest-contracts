/**
 * Pricing rules for the combined NYWE Gallo license.
 *   npx tsx scripts/assert-nywe-combined-contract.mts
 */
import {
  brandsPouredFromCoveredWineries,
  dedupeCoveredWineries,
  emptyCoveredWinery,
  galloContractFieldsFromWineries,
  isGalloBillingCompany,
  nyweCombinedLicensePricing,
  wineriesFromContract,
} from '../lib/nywe-combined-contract.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(isGalloBillingCompany('GALLO'), 'GALLO is the billing parent');
assert(isGalloBillingCompany('E. & J. Gallo Winery'), 'E. & J. Gallo Winery is the billing parent');
assert(isGalloBillingCompany('ej gallo'), 'ej gallo is the billing parent');
assert(!isGalloBillingCompany('Louis M. Martini'), 'a Gallo brand is not the billing parent');
assert(!isGalloBillingCompany('Jermann'), 'Jermann is not the billing parent');

const martini = emptyCoveredWinery('Louis M. Martini');
martini.wine_display = '2019 Cabernet';
martini.source_rows = [{ source_sheet_id: 'sheet', source_sheet_tab: 'Returning', source_row_number: 4 }];
const martiniAgain = emptyCoveredWinery('Louis M. Martini');
martiniAgain.wine_display = '2020 Merlot';
martiniAgain.source_rows = [{ source_sheet_id: 'sheet', source_sheet_tab: 'Returning', source_row_number: 5 }];
const jermann = emptyCoveredWinery('Jermann');

const deduped = dedupeCoveredWineries([martini, martiniAgain, jermann]);
assert(deduped.length === 2, 'same winery on two rows is one license');
assert(deduped[0]?.winery_name === 'Jermann', 'wineries sort by name');
assert(deduped.find((row) => row.winery_name === 'Louis M. Martini')?.source_rows.length === 2, 'both roster rows stay linked');

const names = ['Louis M. Martini', 'Massican', 'Pahlmeyer', 'Rombauer', 'Jermann'];
const fields = galloContractFieldsFromWineries({
  legalName: 'GALLO',
  companyName: 'Louis M. Martini',
  wineries: names.map((name) => emptyCoveredWinery(name)),
  feeCents: 1_400_000,
});
assert(fields.exhibitor_company_name === 'Gallo', 'five brands save as Gallo');
assert(fields.booth_count === 5, 'booth count is the winery count');
assert(fields.booth_rate_cents === 1_400_000, 'rate stays the per-winery license fee');
assert(fields.booth_count * fields.booth_rate_cents === 7_000_000, 'total is 5 × $14,000');
assert(nyweCombinedLicensePricing(1_400_000, 5).booth_count === 5, 'pricing helper matches');
assert(
  brandsPouredFromCoveredWineries(fields.covered_wineries ?? []).includes('Jermann'),
  'the license lists Jermann',
);

const single = wineriesFromContract({
  exhibitor_company_name: 'Jermann',
  exhibitor_legal_name: 'GALLO',
  brands_poured: 'Vintage Tunina',
  covered_wineries: null,
});
assert(single.length === 1 && single[0]?.winery_name === 'Jermann', 'a lone Gallo brand stays one winery');

console.log('nywe combined contract assertions passed');
