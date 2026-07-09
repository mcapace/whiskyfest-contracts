/** Exhibitor signing redirect — token-protected; must not require staff Google login. */
export function isPublicDocuSignSigningApiPath(pathname: string): boolean {
  return /^\/api\/contracts\/[^/]+\/docusign-sign\/?$/.test(pathname);
}

/** Paths reachable without a Shanken Google account (exhibitors / external signers). */
export function isPublicExhibitorPath(pathname: string): boolean {
  return (
    pathname === '/sign' ||
    pathname === '/sign/continue' ||
    pathname === '/signing/complete' ||
    isPublicDocuSignSigningApiPath(pathname)
  );
}
