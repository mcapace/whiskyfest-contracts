import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { mergeAndExportPdf } from '@/lib/google';
import { buildContractMergeMap } from '@/lib/merge-map';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', contract.event_id)
    .single<Event>();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const mergeMap = buildContractMergeMap(contract, event, 'draft');

  const templateDocId = process.env.GOOGLE_TEMPLATE_DOC_ID!;
  const draftsFolderId = process.env.GOOGLE_DRAFTS_FOLDER_ID!;
  const fileName = `${contract.exhibitor_company_name.replace(/[^\w\s-]/g, '')} — WhiskyFest ${event.year} Contract`;

  try {
    const { fileId, webViewLink } = await mergeAndExportPdf(
      templateDocId,
      mergeMap,
      fileName,
      draftsFolderId,
    );

    await supabase
      .from('contracts')
      .update({
        status: 'ready_for_review',
        draft_pdf_drive_id: fileId,
        draft_pdf_url: webViewLink,
        drafted_at: new Date().toISOString(),
      })
      .eq('id', contract.id);

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: session.user.email,
      action: 'pdf_generated',
      metadata: { file_id: fileId, file_url: webViewLink },
    });

    return NextResponse.json({ ok: true, pdf_url: webViewLink });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PDF generation failed:', err);
    await supabase
      .from('contracts')
      .update({ status: 'error', notes: `PDF generation error: ${message}` })
      .eq('id', contract.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
