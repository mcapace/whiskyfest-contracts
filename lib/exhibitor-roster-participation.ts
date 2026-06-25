/** Client-safe participation helpers (no Google Sheets / Node imports). */

/** Participation column is blank — winery is on the roster but has not confirmed yet. */
export function isRosterParticipationPending(participation: string): boolean {
  return !participation.trim();
}

/** Explicit yes / confirmed — winery is actively participating in NYWE. */
export function isActiveRosterParticipation(participation: string): boolean {
  const part = participation.toLowerCase().trim();
  if (!part) return false;
  if (part === 'false' || part === '0') return false;
  if (/\bno\b/.test(part) && !part.includes('yes')) return false;
  return part.includes('yes') || part.includes('confirm') || part === 'true';
}

/** User declined or unchecked participation in Google Sheets. */
export function hasWithdrawnRosterParticipation(participation: string): boolean {
  const part = participation.toLowerCase().trim();
  if (!part) return false;
  if (part === 'false' || part === '0') return true;
  return /\bno\b/.test(part) && !part.includes('yes');
}
