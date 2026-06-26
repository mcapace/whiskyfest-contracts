/** User-facing NYWE portal terminology — contracts workflow, not "vendor licenses". */

export const NYWE_PORTAL_TITLE = 'NYWE Contracts';
export const NYWE_SHORT_LABEL = 'NYWE';
export const NYWE_EVENT_NAME = 'New York Wine Experience';

export const NYWE_LOGIN_HEADLINE = 'Exhibitor contracts';
export const NYWE_LOGIN_TAGLINE = 'Generate, send, and track contracts for the New York Wine Experience';
export const NYWE_LOGIN_FOOTER = 'New York Wine Experience';

export const STAFF_LOGIN_HEADLINE = 'Team sign-in';

export function nyweContractCount(n: number): string {
  return `${n} contract${n === 1 ? '' : 's'}`;
}
