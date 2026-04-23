import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

type SessionUserFlags = {
  pipeline_access?: boolean;
  is_accounting?: boolean;
  role?: string;
};

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
