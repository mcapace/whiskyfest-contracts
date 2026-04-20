import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Public routes
  const isPublic = pathname.startsWith('/auth') || pathname.startsWith('/api/auth') || pathname.startsWith('/api/webhooks');

  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/auth/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
