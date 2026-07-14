/** User-facing Big Smoke / Cigar Aficionado portal terminology. */

export const BIG_SMOKE_PORTAL_TITLE = 'Big Smoke Contracts';
export const BIG_SMOKE_SHORT_LABEL = 'Big Smoke';
export const BIG_SMOKE_BRAND_LABEL = 'Cigar Aficionado';
export const BIG_SMOKE_EVENT_NAME = 'Big Smoke Las Vegas';

export const BIG_SMOKE_LOGIN_HEADLINE = 'Exhibitor contracts';
export const BIG_SMOKE_LOGIN_TAGLINE =
  'Generate, send, and track contracts for Cigar Aficionado Big Smoke events';
export const BIG_SMOKE_LOGIN_FOOTER = 'Cigar Aficionado · Big Smoke';

export function bigSmokeContractCount(n: number): string {
  return `${n} contract${n === 1 ? '' : 's'}`;
}
