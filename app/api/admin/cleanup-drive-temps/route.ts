import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { cleanupOrphanTempGoogleDocs } from '@/lib/google-drive-cleanup';

export const runtime = 'nodejs';

/**
 * Admin-only: remove orphan temp Google Docs from the contracts Drive root folder.
 * GET /api/admin/cleanup-drive-temps?dryRun=true — preview only.
 */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const dryRun = new URL(req.url).searchParams.get('dryRun') === 'true';

  try {
    const result = await cleanupOrphanTempGoogleDocs({ dryRun });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[cleanup-drive-temps]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
