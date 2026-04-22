import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { mergeAndExportPdf } from '@/lib/google';
import { buildContractMergeMap } from '@/lib/merge-map';
import { notifyEventsTeamOfPendingReview } from '@/lib/notifications';
import { requiresDiscountApproval } from '@/lib/contracts';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import type { Contract, ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await assertContractAccess(session, params.id, {
    allowedStatuses: ['draft', 'ready_for_review', 'pending_events_review', 'approved'],
  });
  if (!gate.ok) return gate.response;

  const supabase = getSupabaseAdmin();

  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  if (requiresDiscountApproval(contract)) {
    return NextResponse.json(
      { error: 'Discount approval is required before generating a PDF for submission.' },
      { status: 400 },
    );
  }

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();

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

    const pdfFields = {
      draft_pdf_drive_id: fileId,
      draft_pdf_url: webViewLink,
      drafted_at: new Date().toISOString(),
    };

    const { data: curRow } = await supabase.from('contracts').select('*').eq('id', contract.id).single();
    const cur = curRow as Contract;
    const nowIso = new Date().toISOString();

    const commonAudit = async () => {
      await supabase.from('audit_log').insert({
        contract_id: contract.id,
        actor_email: gate.actor.email,
        action: 'pdf_generated',
        metadata: { file_id: fileId, file_url: webViewLink },
      });
    };

    // Already in queue for events — regenerate PDF only (no duplicate notification).
    if (cur.status === 'pending_events_review' && !cur.events_approved_at) {
      await supabase.from('contracts').update({ ...pdfFields }).eq('id', contract.id);
      await commonAudit();
      revalidateContractPaths(contract.id);
      return NextResponse.json({ ok: true, pdf_url: webViewLink });
    }

    // First submission for events review (draft or legacy ready_for_review).
    if (
      !cur.events_submitted_at &&
      !cur.events_approved_at &&
      (cur.status === 'draft' || cur.status === 'ready_for_review')
    ) {
      await supabase
        .from('contracts')
        .update({
          ...pdfFields,
          status: 'pending_events_review',
          events_submitted_at: nowIso,
        })
        .eq('id', contract.id);

      await supabase.from('audit_log').insert({
        contract_id: contract.id,
        actor_email: gate.actor.email,
        action: 'events_submitted',
        from_status: cur.status,
        to_status: 'pending_events_review',
        metadata: {},
      });

      await commonAudit();

      const { data: after } = await supabase.from('contracts_with_totals').select('*').eq('id', contract.id).single();
      if (after) {
        void notifyEventsTeamOfPendingReview(after as ContractWithTotals).catch((err) =>
          console.error('[notifyEventsTeamOfPendingReview]', err),
        );
      }

      revalidateContractPaths(contract.id);
      return NextResponse.json({ ok: true, pdf_url: webViewLink });
    }

    // Regeneration after a prior submission — clear events approval if present; no email.
    if (cur.events_submitted_at) {
      const hadApproval = Boolean(cur.events_approved_at);

      await supabase
        .from('contracts')
        .update({
          ...pdfFields,
          status: 'pending_events_review',
          events_approved_at: null,
          events_approved_by: null,
          events_approval_reason: null,
        })
        .eq('id', contract.id);

      if (hadApproval) {
        await supabase.from('audit_log').insert({
          contract_id: contract.id,
          actor_email: gate.actor.email,
          action: 'events_approval_reset',
          from_status: cur.status,
          to_status: 'pending_events_review',
          metadata: {
            old_approver: cur.events_approved_by,
            reason: 'contract regenerated',
          },
        });
      }

      await commonAudit();
      revalidateContractPaths(contract.id);
      return NextResponse.json({ ok: true, pdf_url: webViewLink });
    }

    await supabase.from('contracts').update({ ...pdfFields }).eq('id', contract.id);
    await commonAudit();
    revalidateContractPaths(contract.id);

    return NextResponse.json({ ok: true, pdf_url: webViewLink });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PDF generation failed:', err);
    await supabase
      .from('contracts')
      .update({ status: 'error', notes: `PDF generation error: ${message}` })
      .eq('id', contract.id);

    revalidateContractPaths(contract.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
