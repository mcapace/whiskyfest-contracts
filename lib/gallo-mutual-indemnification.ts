import type { docs_v1 } from 'googleapis';

/**
 * Mutual indemnification Lon Gallagher and M. Shanken both approved for Gallo's
 * NYWE licenses. Section 6 of the vendor license is replaced in full. Every
 * other term stays as printed.
 *
 * The find string is the NYWE template paragraph (verified against the August
 * 2026 Gallo licenses). It does not appear in the WhiskyFest or Big Smoke templates.
 */
export const GALLO_INDEMNIFICATION_FIND =
  '6 Indemnification. Licensee agrees to indemnify, defend, and hold harmless Licensor and the Hotel, as well as their respective principals, members, officers, employees, directors, agents, owners, management companies, successors, and assigns, from and against all legal actions, liabilities, obligations, causes of action, damages, penalties, claims, costs, charges, losses, and expenses, including reasonable attorneys\u2019 fees and expenses, which may arise in any manner out of Licensee\u2019s use or operation of the Licensed Space, participation in the Event, or activities on the Hotel premises, and/or in connection with loss of life, bodily or personal injury, or property damage arising from or out of all acts, failures, omissions, or negligence of Licensee or its agents, employees, contractors, or invitees, unless such claims result solely from the gross negligence or willful misconduct of Licensor or the Hotel, as applicable.';

export const GALLO_INDEMNIFICATION_REPLACE =
  '6 Indemnification. The Winery Sponsor indemnifies Wine Spectator Scholarship Foundation/M. Shanken Communications, Inc. against all claims, damages or liability whatsoever arising out of or in any way caused by or connected to this agreement. Wine Spectator Scholarship Foundation/M. Shanken Communications Inc. indemnifies Winery Sponsor against all claims, damages or liability whatsoever arising out of or in any way caused by or connected to this agreement.';

/** Combined $70,000 NYWE license (Jermann, Louis M. Martini, Massican, Pahlmeyer, Rombauer). */
export const GALLO_COMBINED_CONTRACT_ID = 'd21e327c-c85e-450d-8785-bc0dab9362e6';

export const GALLO_INDEMNIFICATION_PENDING_PREFIX = 'pending-gallo-indemnification:';

export const GALLO_INDEMNIFICATION_APPLIED_NOTE =
  'Section 6 indemnification replaced with the mutual clause approved by Lon Gallagher. All other terms unchanged.';

export function galloIndemnificationDocRequest(): docs_v1.Schema$Request {
  return {
    replaceAllText: {
      containsText: { text: GALLO_INDEMNIFICATION_FIND, matchCase: false },
      replaceText: GALLO_INDEMNIFICATION_REPLACE,
    },
  };
}

/**
 * NYWE vendor licenses are the only merge maps that include covered wineries.
 * Limit the clause swap to Gallo's combined NYWE order so other templates are untouched.
 */
export function galloIndemnificationRequestsForMergeMap(
  mergeMap: Record<string, string>,
): docs_v1.Schema$Request[] {
  const legal = (mergeMap['{{exhibitor_legal_name}}'] ?? '').trim().toLowerCase();
  const company = (mergeMap['{{exhibitor_company_name}}'] ?? '').trim().toLowerCase();
  const covered = (mergeMap['{{covered_wineries}}'] ?? '').trim();
  const isGallo = legal === 'gallo' || company === 'gallo' || company.startsWith('gallo (');
  if (!isGallo || !covered) return [];
  return [galloIndemnificationDocRequest()];
}
