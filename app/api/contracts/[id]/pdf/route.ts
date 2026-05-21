import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractPdfAccess } from '@/lib/auth-contract';
import { resolveContractPdf } from '@/lib/contract-pdf-resolve';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const PDF_CACHE_HEADERS = {
  'Content-Type': 'application/pdf',
  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
};

function redirectNoCache(url: string) {
  const res = NextResponse.redirect(url);
  res.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.headers.set('Pragma', 'no-cache');
  return res;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractPdfAccess(session, params.id);
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const variant = searchParams.get('variant') ?? 'auto';

  const supabase = getSupabaseAdmin();
  const resolved = await resolveContractPdf(supabase, gate.contract, variant);

  if (!resolved) {
    return NextResponse.json({ error: 'PDF not available' }, { status: 404 });
  }

  if (resolved.kind === 'redirect') {
    return redirectNoCache(resolved.url);
  }

  return new NextResponse(new Uint8Array(resolved.bytes), { headers: PDF_CACHE_HEADERS });
}
