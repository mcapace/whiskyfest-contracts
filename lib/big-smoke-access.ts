export type BigSmokeAccessUser = {
  role?: string | null;
  is_events_team?: boolean;
  is_accounting?: boolean;
  is_big_smoke_admin?: boolean;
  /** Sales rep or assistant — same pipeline access model as WhiskyFest. */
  pipeline_access?: boolean;
  email?: string | null;
};

/** Full app admin or Big Smoke portal admin. */
export function isBigSmokeAdmin(user: BigSmokeAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(user.is_big_smoke_admin);
}

/**
 * Big Smoke portal access (matches WhiskyFest pipeline model):
 * admins, Big Smoke portal admins, events team, AR, and sales reps / assistants.
 */
export function canAccessBigSmoke(user: BigSmokeAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isBigSmokeAdmin(user)) return true;
  if (user.is_events_team) return true;
  if (user.is_accounting) return true;
  if (user.pipeline_access) return true;
  return false;
}

/** Admin powers on a Big Smoke contract. */
export function bigSmokeContractIsAdmin(
  productKey: string | null | undefined,
  actor: { isAdmin: boolean; isBigSmokeAdmin?: boolean },
): boolean {
  if (actor.isAdmin) return true;
  if (productKey === 'big_smoke' && actor.isBigSmokeAdmin) return true;
  return false;
}
