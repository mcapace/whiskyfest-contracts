/** Known NYWE countersigner emails (Susannah Nolan). Kept server-light for notification routing. */
export const NYWE_COUNTERSIGNER_EMAILS = new Set(['snolan@mshanken.com']);

export function isNyweCountersignerEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && NYWE_COUNTERSIGNER_EMAILS.has(normalized));
}
