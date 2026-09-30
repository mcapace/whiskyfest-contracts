import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { ensureSecondSignerBlockInTemplate } from '@/lib/second-signer-template';
import { fetchGoogleDocPlainText } from '@/lib/google-doc-plain-text';
import { SECOND_SIGNER_BLOCK_TOKEN } from '@/lib/second-signer';
import { WF_BOOTH_TEMPLATE_DOC_ID, WF_SPONSORSHIP_TEMPLATE_DOC_ID } from '@/lib/wf-template-revision-section';

export const runtime = 'nodejs';
export const maxDuration = 60;

function whiskyfestTemplates(): Array<{ label: string; docId: string }> {
  return [
    { label: 'WhiskyFest booth', docId: process.env['GOOGLE_TEMPLATE_DOC_ID']?.trim() || WF_BOOTH_TEMPLATE_DOC_ID },
    {
      label: 'WhiskyFest sponsorship',
      docId: process.env['GOOGLE_SPONSORSHIP_TEMPLATE_DOC_ID']?.trim() || WF_SPONSORSHIP_TEMPLATE_DOC_ID,
    },
  ];
}

/** Report whether each WhiskyFest master already carries the second-signer token. */
export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const templates = await Promise.all(
    whiskyfestTemplates().map(async (t) => {
      try {
        const text = await fetchGoogleDocPlainText(t.docId);
        return { ...t, has_second_signer_block: text.includes(SECOND_SIGNER_BLOCK_TOKEN) };
      } catch (err) {
        return { ...t, has_second_signer_block: null, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );
  return NextResponse.json({ ok: true, templates });
}

/** Insert the token into every WhiskyFest master that lacks it (idempotent). */
export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const templates = await Promise.all(
    whiskyfestTemplates().map(async (t) => ({ ...t, ...(await ensureSecondSignerBlockInTemplate(t.docId)) })),
  );
  const failed = templates.some((t) => t.status === 'error' || t.status === 'anchor_not_found');
  return NextResponse.json({ ok: !failed, templates }, { status: failed ? 502 : 200 });
}
