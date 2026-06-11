export type WineSpectatorAccessUser = {
  role?: string | null;
  is_events_team?: boolean;
  is_wine_spectator_admin?: boolean;
  email?: string | null;
};

/** Explicit allowlist in addition to admin / events team (legacy fallback). */
const WINE_SPECTATOR_ALLOWED_EMAILS = new Set(['snolan@mshanken.com']);

/** Full app admin or Wine Spectator portal admin (NYWE). */
export function isWineSpectatorAdmin(user: WineSpectatorAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(user.is_wine_spectator_admin);
}

/** Wine Spectator portal: admins, events team, portal admins, and legacy allowlist. */
export function canAccessWineSpectator(user: WineSpectatorAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isWineSpectatorAdmin(user)) return true;
  if (user.is_events_team) return true;
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && WINE_SPECTATOR_ALLOWED_EMAILS.has(email));
}

/** Admin powers on a Wine Spectator contract (discount approve, cancel, etc.). */
export function wineSpectatorContractIsAdmin(
  productKey: string | null | undefined,
  actor: { isAdmin: boolean; isWineSpectatorAdmin?: boolean },
): boolean {
  if (actor.isAdmin) return true;
  if (productKey === 'wine_spectator' && actor.isWineSpectatorAdmin) return true;
  return false;
}
