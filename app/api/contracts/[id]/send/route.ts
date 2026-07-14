import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertContractAccess } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { persistContractDraftPdf } from '@/lib/contract-pdf-storage';
import { formatDocuSignErrorForUser, isDocuSignRateLimitError, sendEnvelope } from '@/lib/docusign';
import { fetchContractBoothBrandsOrdered } from '@/lib/contract-booth-brands';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import {
  contractDocuSignEmailBlurb,
  contractDocuSignEmailSubject,
  contractDocuSignFileName,
  contractPdfBaseName,
} from '@/lib/contract-document-naming';
import { eventUsesContractOrderTable } from '@/lib/contract-template-profile';
import {
  countersignerRequiredForEvent,
  docusignCountersignerForEvent,
} from '@/lib/docusign-envelope-recipients';
import { shouldSkipExhibitorDataTabs } from '@/lib/exhibitor-docusign-fields';
import { nyweLicenseAddressError } from '@/lib/nywe-billing';
import { refreshNyweBillingFromRosterForContract } from '@/lib/nywe-roster-billing-sync';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { buildContractMergeMap } from '@/lib/merge-map';
import { requiresDiscountApproval } from '@/lib/contracts';
import { insertContractAudit } from '@/lib/audit-log';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { syncExhibitorRosterWritebackById } from '@/lib/exhibitor-roster-sync-hook';
import { docusignBrandIdForEvent } from '@/lib/product-email';
import { parseSignerCc, validateSignerCcDistinct } from '@/lib/docusign-signer-cc';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

/** POST — send approved contract via DocuSign (exhibitor routing 1; event countersigner routing 2). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();

  const access = await assertContractAccess(session, params.id, { allowedStatuses: ['approved'] });
  if (!access.ok) return access.response;

  const supabase = getSupabaseAdmin();

  let contract = await fetchContractWithTotalsById(supabase, params.id);
  if (!contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  contract = await refreshNyweBillingFromRosterForContract(supabase, contract, event);

  if (requiresDiscountApproval(contract, event)) {
    return NextResponse.json(
      { error: 'Discount approval required before contract can be sent to DocuSign.' },
      { status: 403 },
    );
  }

  if (!contract.events_approved_at) {
    return NextResponse.json(
      { error: 'Events team approval is required before this contract can be sent to DocuSign.' },
      { status: 403 },
    );
  }

  if (event.client_send_enabled === false) {
    return NextResponse.json(
      {
        error:
          'Client send is disabled for this event. Enable it in Events admin when ready to send to exhibitors.',
      },
      { status: 403 },
    );
  }

  if (contract.status !== 'approved') {
    return NextResponse.json(
      {
        error: `Only approved contracts can be sent. Current status: ${contract.status}`,
      },
      { status: 409 },
    );
  }
  if (!contract.signer_1_email || !contract.signer_1_name) {
    return NextResponse.json(
      {
        error: 'Exhibitor signer name and email are required.',
      },
      { status: 400 },
    );
  }

  const addressError = nyweLicenseAddressError(event, contract);
  if (addressError) {
    return NextResponse.json({ error: addressError }, { status: 400 });
  }

  const countersigner = docusignCountersignerForEvent(event);
  if (countersignerRequiredForEvent(event) && !countersigner) {
    return NextResponse.json(
      { error: 'Event countersigner name and email are required.' },
      { status: 500 },
    );
  }

  const signerEmail = contract.signer_1_email.trim();
  const signerName = contract.signer_1_name.trim();
  const carbonCopy = parseSignerCc(contract);
  const ccError = validateSignerCcDistinct({
    signerEmail,
    countersignerEmail: countersigner?.email ?? event.shanken_signatory_email?.trim() ?? '',
    cc: carbonCopy,
  });
  if (ccError) {
    return NextResponse.json({ error: ccError }, { status: 400 });
  }
  const safeCompany = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
  const templateDocId = resolveContractTemplateDocId(contract, event);
  const usesOrderTable = eventUsesContractOrderTable(event);

  try {
    const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
    const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);
    const mergeMap = buildContractMergeMap(contract, event, 'docusign', boothBrands);
    const fileName = `${contractPdfBaseName(contract.exhibitor_company_name, event)} (DocuSign)`;

    const pdfBytes = await renderContractPdfFromTemplate(
      templateDocId,
      mergeMap,
      fileName,
      usesOrderTable ? lineItems : undefined,
      {
        includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(contract),
      },
    );
    const { draftStoragePath, drafted_at } = await persistContractDraftPdf(contract.id, pdfBytes);

    const pdfBase64 = pdfBytes.toString('base64');

    const { envelopeId } = await sendEnvelope({
      pdfBase64,
      documentName: contractDocuSignFileName(contract.exhibitor_company_name, event),
      emailSubject: contractDocuSignEmailSubject(contract.exhibitor_company_name, event),
      emailBlurb: contractDocuSignEmailBlurb(contract.exhibitor_company_name, event),
      signer1: { name: signerName, email: signerEmail },
      countersigner,
      carbonCopy,
      brandId: docusignBrandIdForEvent(event),
      skipExhibitorDataTabs: shouldSkipExhibitorDataTabs(event, contract),
    });

    await supabase
      .from('contracts')
      .update({
        status: 'sent',
        docusign_envelope_id: envelopeId,
        sent_at: new Date().toISOString(),
        pdf_storage_path: draftStoragePath,
        drafted_at,
      })
      .eq('id', contract.id);

    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: access.actor.email,
      action: 'status_changed',
      from_status: 'approved',
      to_status: 'sent',
      metadata: { envelope_id: envelopeId },
    });
    await insertContractAudit(supabase, {
      contract_id: contract.id,
      actor_email: access.actor.email,
      action: 'pdf_sent',
      metadata: {
        envelope_id: envelopeId,
        envelope_status: 'sent',
        exhibitor_signer: contract.signer_1_email,
        signer_cc_email: carbonCopy?.email ?? null,
        countersigner_email: countersigner?.email ?? event.shanken_signatory_email,
        countersigner_name: countersigner?.name ?? event.shanken_signatory_name,
        single_signer_envelope: countersigner == null,
      },
    });

    revalidateContractPaths(contract.id);
    await syncExhibitorRosterWritebackById(contract.id);

    return NextResponse.json({
      ok: true,
      envelope_id: envelopeId,
      exhibitor_signer_email: signerEmail,
    });
  } catch (err: unknown) {
    const message = formatDocuSignErrorForUser(err);
    console.error('[send DocuSign]', contract.id, message);

    await supabase
      .from('contracts')
      .update({
        status: 'error',
        notes: `DocuSign send error: ${message.slice(0, 500)}`,
      })
      .eq('id', contract.id);

    await supabase.from('audit_log').insert({
      contract_id: contract.id,
      actor_email: access.actor.email,
      action: 'pdf_send_failed',
      metadata: { error: message.slice(0, 500) },
    });

    revalidateContractPaths(contract.id);

    return NextResponse.json(
      {
        error: message,
      },
      { status: isDocuSignRateLimitError(err) ? 429 : 500 },
    );
  }
}
