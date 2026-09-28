/**
 * Pricing rules for the combined NYWE Gallo license.
 *   npx tsx scripts/assert-nywe-combined-contract.mts
 */
import {
  blankGalloPartyPatch,
  brandsPouredFromCoveredWineries,
  dedupeCoveredWineries,
  emptyCoveredWinery,
  galloContractFieldsFromWineries,
  contractQualifiesForGalloCombine,
  isGalloBillingCompany,
  isGalloBrandWinery,
  nyweCombinedLicensePricing,
  summarizeGalloForDashboard,
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
assert(isGalloBrandWinery('Louis M. Martini'), 'Louis M. Martini is a Gallo brand');
assert(isGalloBrandWinery('Jermann'), 'Jermann is a Gallo brand');
assert(
  contractQualifiesForGalloCombine({
    exhibitor_company_name: 'Massican',
    exhibitor_legal_name: 'Massican',
  }),
  'a Gallo brand qualifies even without GALLO legal name',
);

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

const eventId = 'event-nywe';
function galloDraft(id: string, company: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    event_id: eventId,
    status: 'draft',
    sent_at: null,
    docusign_envelope_id: null,
    exhibitor_company_name: company,
    exhibitor_legal_name: 'GALLO',
    booth_count: 1,
    booth_rate_cents: 1_400_000,
    grand_total_cents: 1_400_000,
    covered_wineries: null,
    ...extra,
  };
}

const separate = summarizeGalloForDashboard(
  names.map((name, index) => galloDraft(`c${index}`, name)),
  eventId,
  1_400_000,
);
assert(separate != null && !separate.alreadyCombined, 'five unsent Gallo drafts can be combined');
assert(separate?.wineryNames.length === 5, 'dashboard lists each winery once');
assert(separate?.totalCents === 7_000_000, 'dashboard total is 5 × $14,000');
assert(separate?.combinedContractId == null, 'separate drafts do not already have one contract');

const combined = summarizeGalloForDashboard(
  [
    galloDraft('combined', 'Gallo', {
      booth_count: 5,
      grand_total_cents: 7_000_000,
      covered_wineries: names.map((name) => emptyCoveredWinery(name)),
    }),
  ],
  eventId,
  1_400_000,
);
assert(combined?.alreadyCombined === true, 'one multi-winery contract is already combined');
assert(combined?.combinedContractId === 'combined', 'dashboard opens the existing Gallo contract');

const sentAndOpen = summarizeGalloForDashboard(
  [
    galloDraft('sent-martini', 'Louis M. Martini', { status: 'sent', sent_at: '2026-09-01T00:00:00Z' }),
    galloDraft('open-massican', 'Massican'),
    galloDraft('open-jermann', 'Jermann'),
  ],
  eventId,
  1_400_000,
);
assert(sentAndOpen?.needsVoid === true, 'sent Gallo licenses need a void-and-combine action');
assert(sentAndOpen?.wineryNames.includes('Louis M. Martini') === true, 'a sent Gallo winery is included after void');
assert(sentAndOpen?.wineryNames.length === 3, 'sent and unsent wineries are offered for the combined order');
assert(sentAndOpen?.sent.length === 1, 'dashboard lists the sent license to void');

const allSent = summarizeGalloForDashboard(
  [
    galloDraft('sent-martini', 'Louis M. Martini', { status: 'sent', sent_at: '2026-09-01T00:00:00Z' }),
    galloDraft('sent-massican', 'Massican', { status: 'sent', sent_at: '2026-09-01T00:00:00Z' }),
    galloDraft('sent-pahlmeyer', 'Pahlmeyer', { status: 'sent', sent_at: '2026-09-01T00:00:00Z' }),
    galloDraft('sent-rombauer', 'Rombauer', { status: 'sent', sent_at: '2026-09-01T00:00:00Z' }),
  ],
  eventId,
  1_400_000,
);
assert(allSent?.needsVoid === true, 'all-sent Gallo licenses still show the combine card');
assert(allSent?.wineryNames.length === 4, 'four sent Gallo wineries become one $56,000 order after void');
assert(allSent?.totalCents === 5_600_000, 'void-and-combine total is winery count × $14,000');

assert(
  summarizeGalloForDashboard([galloDraft('only', 'Jermann')], eventId, 1_400_000) == null,
  'one unsent Gallo winery does not need a combine card',
);

const keptSigner = blankGalloPartyPatch(
  { signer_1_name: 'Someone Else', signer_1_email: 'else@ejgallo.com' },
  [],
);
assert(keptSigner.signer_1_name == null && keptSigner.signer_1_email == null, 'an existing signer is left in place');
assert(keptSigner.billing_address_line1 === '600 Yosemite Blvd', 'a blank address is filled from the Gallo order');
assert(keptSigner.billing_contact_email === 'emma.bovberg@ejgallo.com', 'billing contact is filled when blank');

const siblingWins = blankGalloPartyPatch(
  {},
  [{ signer_1_name: 'Roster Signer', signer_1_email: 'roster@ejgallo.com', billing_address_line1: '1 Vine St' }],
);
assert(siblingWins.signer_1_email === 'roster@ejgallo.com', 'a sibling draft supplies the signer');
assert(siblingWins.billing_address_line1 === '1 Vine St', 'a sibling street beats the Modesto default');
assert(siblingWins.billing_city === 'Modesto', 'city still falls back when the sibling has none');

console.log('nywe combined contract assertions passed');
