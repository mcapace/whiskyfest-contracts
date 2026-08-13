/**
 * People who should never receive internal contract workflow emails
 * (discount alerts, events-team blasts, etc.). Portal login is unaffected.
 */
export const NOTIFICATION_BLOCKED_EMAILS = new Set([
  'cmcgilvray@mshanken.com', // Connie McGilvray — opted out of all contract alerts
]);

export function isNotificationBlockedEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && NOTIFICATION_BLOCKED_EMAILS.has(normalized));
}

/** Merge env exclusions + hardcoded blocked list. */
export function notificationExcludedEmailSet(extraEnvRaw?: string): Set<string> {
  const fromEnv = (extraEnvRaw ?? process.env['NOTIFICATION_EXCLUDED_EMAILS'] ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...NOTIFICATION_BLOCKED_EMAILS, ...fromEnv]);
}
