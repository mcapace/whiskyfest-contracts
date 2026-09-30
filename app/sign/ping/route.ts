import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Keep-alive target for embedded DocuSign signing sessions (`pingUrl` on the recipient view).
 * DocuSign's signing page loads this every few minutes; any 2xx keeps the session open.
 * Public: exhibitors are never logged into the portal.
 */
export function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export const HEAD = GET;
