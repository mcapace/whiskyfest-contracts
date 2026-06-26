import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { IMPERSONATION_READ_ONLY_MESSAGE } from '@/lib/impersonation-read-only';
import {
  isNywePortalHost,
  isNywePortalPath,
  isWhiskyfestOnlyPath,
  nyweCrossDomainPath,
  nyweInternalPath,
  nywePortalOrigin,
  nywePublicPath,
  portalKindFromHost,
} from '@/lib/portal-host';
import { canAccessWineSpectator } from '@/lib/wine-spectator-access';

type SessionUserFlags = {
  pipeline_access?: boolean;
  is_accounting?: boolean;
  is_events_team?: boolean;
  wine_spectator_access?: boolean;
  role?: string;
  email?: string;
};

const READ_ONLY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function applyPortalHeader(res: NextResponse, host: string | null): NextResponse {
  res.headers.set('x-portal-kind', portalKindFromHost(host));
  return res;
}

export default auth((req) => {
  const host = req.headers.get('host');
  const { pathname } = req.nextUrl;
  const nyweHost = isNywePortalHost(host);

  const isPublic =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/api/cron');

  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin);
    return applyPortalHeader(NextResponse.redirect(loginUrl), host);
  }

  let response: NextResponse | null = null;

  if (nyweHost) {
    if (pathname.startsWith('/wine-spectator')) {
      const clean = nywePublicPath(pathname);
      if (clean !== pathname) {
        response = NextResponse.redirect(new URL(clean, req.url));
      }
    } else if (pathname.startsWith('/accounting/nywe')) {
      const clean = nywePublicPath(pathname);
      if (clean !== pathname) {
        response = NextResponse.redirect(new URL(clean, req.url));
      }
    } else {
      const internal = nyweInternalPath(pathname);
      if (internal && internal !== pathname) {
        const url = req.nextUrl.clone();
        url.pathname = internal;
        response = NextResponse.rewrite(url);
      } else if (isWhiskyfestOnlyPath(pathname) && !pathname.startsWith('/api/')) {
        response = NextResponse.redirect(new URL('/', req.url));
      }
    }
  } else if (
    !pathname.startsWith('/api/') &&
    (pathname === '/wine-spectator' ||
      pathname.startsWith('/wine-spectator/') ||
      pathname === '/accounting/nywe' ||
      pathname.startsWith('/accounting/nywe/'))
  ) {
    const target = `${nywePortalOrigin()}${nyweCrossDomainPath(pathname)}`;
    response = NextResponse.redirect(target);
  }

  if (response) {
    return applyPortalHeader(response, host);
  }

  const session = req.auth as (Session & { is_read_only_impersonation?: boolean }) | null;

  if (session && READ_ONLY_METHODS.has(req.method)) {
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/webhooks')) {
      if (session.is_read_only_impersonation) {
        const u = session.user as SessionUserFlags | undefined;
        const accountingImpersonationWrite =
          pathname.startsWith('/api/accounting/') && Boolean(u?.is_accounting);
        if (!accountingImpersonationWrite) {
          return NextResponse.json({ error: IMPERSONATION_READ_ONLY_MESSAGE }, { status: 403 });
        }
      }
    }
  }

  if (req.auth?.user) {
    const u = req.auth.user as SessionUserFlags;
    const pipeline = Boolean(u.pipeline_access);
    const accounting = Boolean(u.is_accounting);
    const admin = u.role === 'admin';

    const accountingOnly = accounting && !pipeline;
    const canOpenAccounting = accounting || admin;

    if (accountingOnly) {
      const accountingPath = nyweHost
        ? pathname === '/accounting' || pathname.startsWith('/accounting/')
        : pathname.startsWith('/accounting');
      const allowed = accountingPath || pathname.startsWith('/api/accounting') || isPublic;
      if (!allowed) {
        const dest = nyweHost ? '/accounting' : '/accounting';
        return applyPortalHeader(NextResponse.redirect(new URL(dest, req.nextUrl.origin)), host);
      }
    }

    const whiskyfestAccountingPath =
      pathname === '/accounting' || (pathname.startsWith('/accounting/') && !pathname.startsWith('/accounting/nywe'));
    if (whiskyfestAccountingPath && !canOpenAccounting && !nyweHost) {
      return applyPortalHeader(NextResponse.redirect(new URL('/', req.nextUrl.origin)), host);
    }

    const nyweAccountingPath =
      pathname === '/accounting/nywe' ||
      pathname.startsWith('/accounting/nywe/') ||
      (nyweHost && (pathname === '/accounting' || pathname.startsWith('/accounting/')));
    if (nyweAccountingPath && !canOpenAccounting) {
      const dest = nyweHost ? '/' : '/';
      return applyPortalHeader(NextResponse.redirect(new URL(dest, req.nextUrl.origin)), host);
    }

    const wineSpectatorPath =
      isNywePortalPath(pathname, host) || pathname.startsWith('/api/wine-spectator');
    if (
      wineSpectatorPath &&
      !canAccessWineSpectator({
        role: u.role,
        is_events_team: u.is_events_team,
        email: u.email,
      })
    ) {
      const dest = accountingOnly ? (nyweHost ? '/accounting' : '/accounting') : nyweHost ? '/' : '/';
      return applyPortalHeader(NextResponse.redirect(new URL(dest, req.nextUrl.origin)), host);
    }

    if (nyweHost && !admin && !canAccessWineSpectator({ role: u.role, is_events_team: u.is_events_team, email: u.email })) {
      if (!accountingOnly) {
        return applyPortalHeader(NextResponse.redirect(new URL('/auth/login', req.nextUrl.origin)), host);
      }
    }
  }

  return applyPortalHeader(NextResponse.next(), host);
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
