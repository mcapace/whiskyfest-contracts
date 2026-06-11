export type WineSpectatorAccessUser = {
  role?: string | null;
  is_events_team?: boolean;
  email?: string | null;
};

/** Explicit allowlist in addition to admin / events team (Susannah Nolan). */
const WINE_SPECTATOR_ALLOWED_EMAILS = new Set(['snolan@mshanken.com']);

/** Wine Spectator portal: admins, events team, and Susannah Nolan only. */
export function canAccessWineSpectator(user: WineSpectatorAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.is_events_team) return true;
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && WINE_SPECTATOR_ALLOWED_EMAILS.has(email));
}
