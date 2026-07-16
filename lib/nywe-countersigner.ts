/** Known NYWE countersigner emails (Susannah Nolan). NYWE-only — not WhiskyFest / Big Smoke. */
export const NYWE_COUNTERSIGNER_EMAILS = new Set(['snolan@mshanken.com']);

export function isNyweCountersignerEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && NYWE_COUNTERSIGNER_EMAILS.has(normalized));
}
