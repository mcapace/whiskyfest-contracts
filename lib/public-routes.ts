/** Exhibitor signing redirect — token-protected; must not require staff Google login. */
export function isPublicDocuSignSigningApiPath(pathname: string): boolean {
  return /^\/api\/contracts\/[^/]+\/docusign-sign\/?$/.test(pathname);
}

/** Booth QR landing — Rebrandly conversion script, then redirect to the winery site. */
export function isNyweBoothQrRedirectPath(pathname: string): boolean {
  return /^\/b\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(
    pathname,
  );
}

/** Paths reachable without a Shanken Google account (exhibitors / external signers). */
export function isPublicExhibitorPath(pathname: string): boolean {
  return (
    pathname === '/sign' ||
    pathname === '/sign/continue' ||
    pathname === '/signing/complete' ||
    isNyweBoothQrRedirectPath(pathname) ||
    isPublicDocuSignSigningApiPath(pathname)
  );
}
