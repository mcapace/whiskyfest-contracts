import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { mergeAndExportPdf } from '@/lib/google';
import { formatCurrency } from '@/lib/utils';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getSupabaseAdmin();

  // Load contract + event
  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const { data: event } = await supabase
    .from('events').select('*').eq('id', contract.event_id).single<Event>();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Build merge map
  const today = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const eventDate = new Date(event.event_date);

  const mergeMap: Record<string, string> = {
    '{{event_year}}':             String(event.year),
    '{{event_tagline}}':          event.tagline ?? '',
    '{{event_location}}':         event.location ?? '',
    '{{event_date}}':             eventDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    '{{event_venue}}':            event.venue ?? '',
    '{{agreement_day}}':          String(today.getDate()),
    '{{agreement_month}}':        months[today.getMonth()],
    '{{agreement_year}}':         String(today.getFullYear()),
    '{{exhibitor_legal_name}}':   contract.exhibitor_legal_name,
    '{{exhibitor_company_name}}': contract.exhibitor_company_name,
    '{{exhibitor_address}}':      contract.exhibitor_address ?? '',
    '{{exhibitor_telephone}}':    contract.exhibitor_telephone ?? '',
    '{{brands_poured}}':          contract.brands_poured ?? '',
    '{{booth_count}}':            String(contract.booth_count),
    '{{booth_rate}}':             formatCurrency(contract.booth_rate_cents).replace('$', '').trim(),
    '{{booth_subtotal}}':         formatCurrency(contract.booth_subtotal_cents).replace('$', '').trim(),
    '{{additional_brand_count}}': String(contract.additional_brand_count),
    '{{additional_brand_fee}}':   formatCurrency(contract.additional_brand_fee_cents).replace('$', '').trim(),
    '{{grand_total}}':            formatCurrency(contract.grand_total_cents).replace('$', '').trim(),
    '{{signer_1_name}}':          contract.signer_1_name ?? '',
    '{{signer_1_title}}':         contract.signer_1_title ?? '',
    '{{shanken_signatory_name}}': event.shanken_signatory_name,
    '{{shanken_signatory_title}}':event.shanken_signatory_title,
    '{{shanken_signatory_email}}':event.shanken_signatory_email,
    // Phase 1: signature anchors are blank lines; Phase 2 will populate with DocuSign anchor tags
    '{{sig_anchor_1}}':           '_______________________________',
    '{{date_anchor_1}}':          '________________',
    '{{sig_anchor_2}}':           '_______________________________',
    '{{date_anchor_2}}':          '________________',
  };

  // Generate the PDF
  const templateDocId   = process.env.GOOGLE_TEMPLATE_DOC_ID!;
  const draftsFolderId  = process.env.GOOGLE_DRAFTS_FOLDER_ID!;
  const fileName        = `${contract.exhibitor_company_name.replace(/[^\w\s-]/g, '')} — WhiskyFest ${event.year} Contract`;

  try {
    const { fileId, webViewLink } = await mergeAndExportPdf(
      templateDocId, mergeMap, fileName, draftsFolderId
    );

    // Update contract record
    await supabase
      .from('contracts')
      .update({
        status:             'ready_for_review',
        draft_pdf_drive_id: fileId,
        draft_pdf_url:      webViewLink,
        drafted_at:         new Date().toISOString(),
      })
      .eq('id', contract.id);

    // Audit
    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: session.user.email,
      action:      'pdf_generated',
      metadata:    { file_id: fileId, file_url: webViewLink },
    });

    return NextResponse.json({ ok: true, pdf_url: webViewLink });
  } catch (err: any) {
    console.error('PDF generation failed:', err);
    await supabase
      .from('contracts')
      .update({ status: 'error', notes: `PDF generation error: ${err.message}` })
      .eq('id', contract.id);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
