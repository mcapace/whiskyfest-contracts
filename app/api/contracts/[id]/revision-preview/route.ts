import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { reviseAndSendBodySchema } from '@/lib/contract-revision';
import { renderContractRevisionPreview } from '@/lib/contract-revision-preview';
import { describeUnappliedRevision } from '@/lib/google';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Preview the revised contract before voiding / resending. Same body as revise-and-send; the
 * reason is optional here. Returns the PDF (base64) plus which edits did not apply.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
  if (!gate.ok) return gate.response;

  if (!gate.actor.isAdmin && !gate.actor.isEventsTeam) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = reviseAndSendBodySchema.safeParse({
    ...(raw ?? {}),
    reason: typeof raw?.reason === 'string' && raw.reason.trim().length >= 10 ? raw.reason : 'Preview only',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await renderContractRevisionPreview({ contractId: params.id, body: parsed.data });
    const hasWarnings = result.report.unmatchedText.length > 0 || result.report.unmatchedParagraphs.length > 0;
    return NextResponse.json({
      ok: true,
      pdf_base64: result.pdf.toString('base64'),
      plan: result.plan,
      preview_lines: result.previewLines,
      applied: {
        text_edits: result.report.appliedTextEdits,
        paragraph_edits: result.report.appliedParagraphEdits,
      },
      warnings: hasWarnings ? describeUnappliedRevision(result.report) : null,
      unmatched: {
        text: result.report.unmatchedText,
        paragraphs: result.report.unmatchedParagraphs,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed';
    console.error('[revision-preview]', params.id, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
