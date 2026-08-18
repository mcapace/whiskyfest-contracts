/** NYWE vendor licenses portal — separate hostname from WhiskyFest. */
export const NYWE_PORTAL_HOST =
  process.env['NYWE_PORTAL_HOST']?.trim().toLowerCase() || 'nywecontracts.winespectator.com';

/** Primary WhiskyFest contracts hostname (optional; used for cross-domain redirects). */
export const WHISKYFEST_PORTAL_HOST =
  process.env['WHISKYFEST_PORTAL_HOST']?.trim().toLowerCase() || 'wacontracts.whiskyadvocate.com';

/** Big Smoke / Cigar Aficionado contracts portal. */
export const BIG_SMOKE_PORTAL_HOST =
  process.env['BIG_SMOKE_PORTAL_HOST']?.trim().toLowerCase() || 'bigsmokecontracts.cigaraficionado.com';

export type PortalKind = 'nywe' | 'whiskyfest' | 'big_smoke';

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').split(':')[0].toLowerCase().replace(/^www\./, '');
}

export function isNywePortalHost(host: string | null | undefined): boolean {
  return normalizeHost(host) === normalizeHost(NYWE_PORTAL_HOST);
}

export function isBigSmokePortalHost(host: string | null | undefined): boolean {
  return normalizeHost(host) === normalizeHost(BIG_SMOKE_PORTAL_HOST);
}

export function portalKindFromHost(host: string | null | undefined): PortalKind {
  if (isNywePortalHost(host)) return 'nywe';
  if (isBigSmokePortalHost(host)) return 'big_smoke';
  return 'whiskyfest';
}

export function nywePortalOrigin(): string {
  const explicit = process.env['NYWE_PORTAL_ORIGIN']?.trim().replace(/\/$/, '');
  if (explicit) return explicit;
  return `https://${NYWE_PORTAL_HOST}`;
}

export function bigSmokePortalOrigin(): string {
  const explicit = process.env['BIG_SMOKE_PORTAL_ORIGIN']?.trim().replace(/\/$/, '');
  if (explicit) return explicit;
  return `https://${BIG_SMOKE_PORTAL_HOST}`;
}

export function whiskyfestPortalOrigin(): string {
  const explicit = process.env['WHISKYFEST_PORTAL_ORIGIN']?.trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const fromNextAuth = process.env['NEXTAUTH_URL']?.trim().replace(/\/$/, '');
  if (fromNextAuth) {
    try {
      if (normalizeHost(new URL(fromNextAuth).host) === normalizeHost(WHISKYFEST_PORTAL_HOST)) {
        return fromNextAuth;
      }
    } catch {
      // ignore malformed NEXTAUTH_URL
    }
  }
  return `https://${WHISKYFEST_PORTAL_HOST}`;
}

export function portalOriginForKind(kind: PortalKind): string {
  if (kind === 'nywe') return nywePortalOrigin();
  if (kind === 'big_smoke') return bigSmokePortalOrigin();
  return whiskyfestPortalOrigin();
}

/** Paths that belong to the NYWE portal (including clean URLs on the NYWE hostname). */
export function isNywePortalPath(pathname: string, host?: string | null): boolean {
  if (pathname === '/wine-spectator' || pathname.startsWith('/wine-spectator/')) return true;
  if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) return true;
  if (host && isNywePortalHost(host) && isNyweCleanPublicPath(pathname)) return true;
  return false;
}

/** Paths that belong to the Big Smoke portal (including clean URLs on the BS hostname). */
export function isBigSmokePortalPath(pathname: string, host?: string | null): boolean {
  if (pathname === '/big-smoke' || pathname.startsWith('/big-smoke/')) return true;
  if (pathname === '/accounting/big-smoke' || pathname.startsWith('/accounting/big-smoke/')) return true;
  if (host && isBigSmokePortalHost(host) && isBigSmokeCleanPublicPath(pathname)) return true;
  return false;
}

export function isNyweCleanPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/roster' || pathname === '/qr') return true;
  if (pathname === '/contracts' || pathname.startsWith('/contracts/')) return true;
  if (pathname === '/accounting' || pathname.startsWith('/accounting/')) return true;
  return false;
}

export function isBigSmokeCleanPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname === '/contracts' || pathname.startsWith('/contracts/')) return true;
  if (pathname === '/events' || pathname.startsWith('/events/')) return true;
  if (pathname === '/accounting' || pathname.startsWith('/accounting/')) return true;
  return false;
}

/** Internal Next.js path for NYWE routes (always under /wine-spectator or /accounting/nywe). */
export function nyweInternalPath(pathname: string): string | null {
  if (pathname === '/wine-spectator' || pathname.startsWith('/wine-spectator/')) return pathname;
  if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) return pathname;

  if (pathname === '/') return '/wine-spectator';
  if (pathname === '/roster') return '/wine-spectator/roster';
  if (pathname === '/qr') return '/wine-spectator/qr';
  if (pathname === '/contracts') return '/wine-spectator/contracts';
  if (pathname.startsWith('/contracts/')) return `/wine-spectator${pathname}`;
  if (pathname === '/accounting') return '/accounting/nywe';
  // Contract detail stays at /accounting/[id] (shared route for both portals).
  if (pathname.startsWith('/accounting/')) return null;

  return null;
}

/** Internal Next.js path for Big Smoke routes (always under /big-smoke or /accounting/big-smoke). */
export function bigSmokeInternalPath(pathname: string): string | null {
  if (pathname === '/big-smoke' || pathname.startsWith('/big-smoke/')) return pathname;
  if (pathname === '/accounting/big-smoke' || pathname.startsWith('/accounting/big-smoke/')) return pathname;

  if (pathname === '/') return '/big-smoke';
  if (pathname === '/contracts') return '/big-smoke/contracts';
  if (pathname.startsWith('/contracts/')) return `/big-smoke${pathname}`;
  if (pathname === '/events' || pathname.startsWith('/events/')) return pathname;
  if (pathname === '/accounting') return '/accounting/big-smoke';
  if (pathname.startsWith('/accounting/')) return null;

  return null;
}

/** Public URL path shown in the browser on the NYWE hostname. */
export function nywePublicPath(internalPath: string): string {
  if (internalPath === '/wine-spectator' || internalPath.startsWith('/wine-spectator/')) {
    return internalPath.replace(/^\/wine-spectator/, '') || '/';
  }
  if (internalPath === '/accounting/nywe' || internalPath.startsWith('/accounting/nywe/')) {
    return internalPath.replace(/^\/accounting\/nywe/, '/accounting') || '/accounting';
  }
  return internalPath;
}

/** Public URL path shown in the browser on the Big Smoke hostname. */
export function bigSmokePublicPath(internalPath: string): string {
  if (internalPath === '/big-smoke' || internalPath.startsWith('/big-smoke/')) {
    return internalPath.replace(/^\/big-smoke/, '') || '/';
  }
  if (internalPath === '/accounting/big-smoke' || internalPath.startsWith('/accounting/big-smoke/')) {
    return internalPath.replace(/^\/accounting\/big-smoke/, '/accounting') || '/accounting';
  }
  return internalPath;
}

/** Link href for NYWE UI — clean paths on NYWE host, legacy paths elsewhere. */
export function nyweHref(internalPath: string, portalKind: PortalKind): string {
  if (portalKind === 'nywe') return nywePublicPath(internalPath);
  return internalPath;
}

/** Link href for Big Smoke UI — clean paths on BS host, prefixed paths elsewhere. */
export function bigSmokeHref(internalPath: string, portalKind: PortalKind): string {
  if (portalKind === 'big_smoke') return bigSmokePublicPath(internalPath);
  return internalPath;
}

/** Strip /wine-spectator prefix when redirecting from WhiskyFest host to NYWE domain. */
export function nyweCrossDomainPath(pathname: string): string {
  if (pathname === '/wine-spectator' || pathname.startsWith('/wine-spectator/')) {
    return nywePublicPath(pathname);
  }
  if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) {
    return nywePublicPath(pathname);
  }
  return pathname;
}

/** Strip /big-smoke prefix when redirecting from another host to Big Smoke domain. */
export function bigSmokeCrossDomainPath(pathname: string): string {
  if (pathname === '/big-smoke' || pathname.startsWith('/big-smoke/')) {
    return bigSmokePublicPath(pathname);
  }
  if (pathname === '/accounting/big-smoke' || pathname.startsWith('/accounting/big-smoke/')) {
    return bigSmokePublicPath(pathname);
  }
  return pathname;
}

const WHISKYFEST_ONLY_PREFIXES = [
  '/sales-reps',
  '/users',
  '/contracts/import',
  '/admin',
  '/sponsors',
];

export function isWhiskyfestOnlyPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (
    pathname.startsWith('/contracts') &&
    !pathname.startsWith('/wine-spectator/contracts') &&
    !pathname.startsWith('/big-smoke/contracts')
  ) {
    return true;
  }
  if (WHISKYFEST_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (
    pathname === '/accounting' ||
    (pathname.startsWith('/accounting/') &&
      !pathname.startsWith('/accounting/nywe') &&
      !pathname.startsWith('/accounting/big-smoke'))
  ) {
    // Shared contract detail (/accounting/[id]) is allowed on product hostnames.
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 2 && segments[0] === 'accounting') return false;
    return true;
  }
  return false;
}

/** Paths that only exist on the NYWE hostname (block on WhiskyFest / Big Smoke domains). */
export function isNyweOnlyPath(pathname: string): boolean {
  if (pathname === '/roster' || pathname.startsWith('/roster/')) return true;
  if (pathname === '/qr' || pathname.startsWith('/qr/')) return true;
  if (pathname === '/wine-spectator' || pathname.startsWith('/wine-spectator/')) return true;
  if (pathname === '/accounting/nywe' || pathname.startsWith('/accounting/nywe/')) return true;
  return false;
}

/** Paths that only exist on the Big Smoke hostname (block on other domains). */
export function isBigSmokeOnlyPath(pathname: string): boolean {
  if (pathname === '/big-smoke' || pathname.startsWith('/big-smoke/')) return true;
  if (pathname === '/accounting/big-smoke' || pathname.startsWith('/accounting/big-smoke/')) return true;
  return false;
}

export type PortalUserFlags = {
  pipeline_access?: boolean;
  is_accounting?: boolean;
  wine_spectator_access?: boolean;
  big_smoke_access?: boolean;
  role?: string;
};

export function isFullPortalAdmin(user: PortalUserFlags): boolean {
  return user.role === 'admin';
}

/** NYWE team member without WhiskyFest pipeline (admins excluded — they use both domains). */
export function isNyweExclusiveUser(user: PortalUserFlags): boolean {
  if (isFullPortalAdmin(user)) return false;
  return (
    Boolean(user.wine_spectator_access) &&
    !Boolean(user.pipeline_access) &&
    !Boolean(user.big_smoke_access)
  );
}

/** Big Smoke team member without WhiskyFest pipeline or NYWE-only access. */
export function isBigSmokeExclusiveUser(user: PortalUserFlags): boolean {
  if (isFullPortalAdmin(user)) return false;
  return (
    Boolean(user.big_smoke_access) &&
    !Boolean(user.pipeline_access) &&
    !Boolean(user.wine_spectator_access)
  );
}

/** WhiskyFest sales/events user without NYWE or Big Smoke access (admins excluded). */
export function isWhiskyfestExclusiveUser(user: PortalUserFlags): boolean {
  if (isFullPortalAdmin(user)) return false;
  return (
    Boolean(user.pipeline_access) &&
    !Boolean(user.wine_spectator_access) &&
    !Boolean(user.big_smoke_access)
  );
}

/**
 * Dual-portal AR: `is_accounting` with Wine Spectator and/or Big Smoke access.
 * These users may use product AR dashboards without being bounced between hosts.
 */
export function isDualPortalAccountingUser(user: PortalUserFlags): boolean {
  if (isFullPortalAdmin(user)) return false;
  const productAr = Boolean(user.wine_spectator_access) || Boolean(user.big_smoke_access);
  return Boolean(user.is_accounting) && productAr && !Boolean(user.pipeline_access);
}

/** Accounting-only user locked to WhiskyFest AR (no product portal access). */
export function isWhiskyfestAccountingOnlyUser(user: PortalUserFlags): boolean {
  if (isFullPortalAdmin(user)) return false;
  if (isDualPortalAccountingUser(user)) return false;
  const accountingOnly = Boolean(user.is_accounting) && !Boolean(user.pipeline_access);
  return (
    accountingOnly && !Boolean(user.wine_spectator_access) && !Boolean(user.big_smoke_access)
  );
}

/** Accounting-only user locked to NYWE AR (exclusive; no WhiskyFest AR). */
export function isNyweAccountingOnlyUser(user: PortalUserFlags): boolean {
  if (isFullPortalAdmin(user)) return false;
  if (isDualPortalAccountingUser(user)) return false;
  const accountingOnly = Boolean(user.is_accounting) && !Boolean(user.pipeline_access);
  return accountingOnly && Boolean(user.wine_spectator_access) && !Boolean(user.big_smoke_access);
}

/** Accounting-only user locked to Big Smoke AR. */
export function isBigSmokeAccountingOnlyUser(user: PortalUserFlags): boolean {
  if (isFullPortalAdmin(user)) return false;
  if (isDualPortalAccountingUser(user)) return false;
  const accountingOnly = Boolean(user.is_accounting) && !Boolean(user.pipeline_access);
  return accountingOnly && Boolean(user.big_smoke_access) && !Boolean(user.wine_spectator_access);
}

export function productKeyForPortalKind(
  portalKind: PortalKind,
): 'wine_spectator' | 'whiskyfest' | 'big_smoke' {
  if (portalKind === 'nywe') return 'wine_spectator';
  if (portalKind === 'big_smoke') return 'big_smoke';
  return 'whiskyfest';
}

export function requestOrigin(req: { headers: Headers; nextUrl?: { origin: string } }): string {
  const host = req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${normalizeHost(host)}`;
  }
  return req.nextUrl?.origin ?? whiskyfestPortalOrigin();
}

export function requestUrl(req: { headers: Headers; nextUrl?: { origin: string } }, pathname: string): URL {
  return new URL(pathname, requestOrigin(req));
}

export function postLoginPath(portalKind: PortalKind, user: PortalUserFlags): string {
  const accountingOnly = Boolean(user.is_accounting) && !Boolean(user.pipeline_access);
  if (accountingOnly) {
    return '/accounting';
  }
  if (portalKind === 'nywe' || portalKind === 'big_smoke') return '/';
  return '/';
}
