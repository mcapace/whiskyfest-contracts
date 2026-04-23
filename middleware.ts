import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { IMPERSONATION_READ_ONLY_MESSAGE } from '@/lib/impersonation-read-only';

type SessionUserFlags = {
  pipeline_access?: boolean;
  is_accounting?: boolean;
  role?: string;
};

const READ_ONLY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks');

  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  const session = req.auth as (Session & { is_read_only_impersonation?: boolean }) | null;

  if (session && READ_ONLY_METHODS.has(req.method)) {
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth') && !pathname.startsWith('/api/webhooks')) {
      if (session.is_read_only_impersonation) {
        return NextResponse.json({ error: IMPERSONATION_READ_ONLY_MESSAGE }, { status: 403 });
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
      const allowed =
        pathname.startsWith('/accounting') ||
        pathname.startsWith('/api/accounting') ||
        isPublic;
      if (!allowed) {
        return NextResponse.redirect(new URL('/accounting', req.nextUrl.origin));
      }
    }

    if (pathname.startsWith('/accounting') && !canOpenAccounting) {
      return NextResponse.redirect(new URL('/', req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
