import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { persistContractDraftPdf } from '@/lib/contract-pdf-storage';
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
import { nyweLicenseAddressError } from '@/lib/nywe-billing';
import { refreshNyweBillingFromRosterForContract } from '@/lib/nywe-roster-billing-sync';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { buildContractMergeMap } from '@/lib/merge-map';
import { requiresDiscountApproval } from '@/lib/contracts';
import { sendEnvelope, voidEnvelope } from '@/lib/docusign';
import { syncExhibitorRosterWritebackById } from '@/lib/exhibitor-roster-sync-hook';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { docusignBrandIdForEvent } from '@/lib/product-email';
import { parseSignerCc, validateSignerCcDistinct } from '@/lib/docusign-signer-cc';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

const schema = z.object({
  signer_1_name: z.string().trim().min(1).optional(),
  signer_1_email: z.string().trim().email().optional(),
});

/**
 * Admin-only: void old DocuSign contract, apply optional signer corrections, and create a new DocuSign contract.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid signer changes.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let contract = await fetchContractWithTotalsById(supabase, params.id);

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  contract = await refreshNyweBillingFromRosterForContract(supabase, contract, event);

  if (requiresDiscountApproval(contract, event)) {
    return NextResponse.json(
      { error: 'Discount approval required before contract can be sent to DocuSign.' },
      { status: 403 },
    );
  }
  if (contract.status !== 'sent' && contract.status !== 'partially_signed') {
    return NextResponse.json(
      { error: 'Resend with Changes is only available while the DocuSign contract is sent or partially signed.' },
      { status: 409 },
    );
  }

  const oldEnvelopeId = contract.docusign_envelope_id?.trim();
  if (!oldEnvelopeId) {
    return NextResponse.json({ error: 'No DocuSign contract is linked to this record.' }, { status: 409 });
  }

  const lineItems = await fetchContractLineItemsOrdered(supabase, contract.id);
  const boothBrands = await fetchContractBoothBrandsOrdered(supabase, contract.id);

  const oldSignerEmail = contract.signer_1_email ?? null;
  const oldSignerName = contract.signer_1_name ?? null;
  const newSignerName = parsed.data.signer_1_name ?? oldSignerName;
  const newSignerEmail = parsed.data.signer_1_email ?? oldSignerEmail;

  if (!newSignerName || !newSignerEmail) {
    return NextResponse.json({ error: 'Exhibitor signer name and email are required.' }, { status: 400 });
  }

  const addressError = nyweLicenseAddressError(event, contract);
  if (addressError) {
    return NextResponse.json({ error: addressError }, { status: 400 });
  }

  try {
    await voidEnvelope(oldEnvelopeId, `Resent with updated info — ${gate.session.user.email}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (parsed.data.signer_1_name || parsed.data.signer_1_email) {
    const { error: signerUpdateError } = await supabase
      .from('contracts')
      .update({
        signer_1_name: newSignerName,
        signer_1_email: newSignerEmail,
      })
      .eq('id', contract.id);
    if (signerUpdateError) {
      return NextResponse.json({ error: signerUpdateError.message }, { status: 500 });
    }
  }

  const mergedContract: ContractWithTotals = {
    ...contract,
    signer_1_name: newSignerName,
    signer_1_email: newSignerEmail,
    docusign_envelope_id: null,
  };

  const templateDocId = resolveContractTemplateDocId(mergedContract, event);
  const mergeMap = buildContractMergeMap(mergedContract, event, 'docusign', boothBrands);
  const fileName = `${contractPdfBaseName(contract.exhibitor_company_name, event)} (DocuSign)`;
  const usesOrderTable = eventUsesContractOrderTable(event);

  let newEnvelopeId: string;
  try {
    const countersigner = docusignCountersignerForEvent(event);
    if (countersignerRequiredForEvent(event) && !countersigner) {
      return NextResponse.json({ error: 'Event countersigner name and email are required.' }, { status: 500 });
    }

    const carbonCopy = parseSignerCc(mergedContract);
    const ccError = validateSignerCcDistinct({
      signerEmail: newSignerEmail,
      countersignerEmail: countersigner?.email ?? event.shanken_signatory_email?.trim() ?? '',
      cc: carbonCopy,
    });
    if (ccError) {
      return NextResponse.json({ error: ccError }, { status: 400 });
    }

    const pdfBytes = await renderContractPdfFromTemplate(
      templateDocId,
      mergeMap,
      fileName,
      usesOrderTable ? lineItems : undefined,
      {
        includeBoothRow: usesOrderTable && !isSponsorshipOnlyOrder(mergedContract),
      },
    );
    const { draftStoragePath, drafted_at } = await persistContractDraftPdf(contract.id, pdfBytes);

    const sent = await sendEnvelope({
      pdfBase64: pdfBytes.toString('base64'),
      documentName: contractDocuSignFileName(contract.exhibitor_company_name, event),
      emailSubject: contractDocuSignEmailSubject(contract.exhibitor_company_name, event),
      emailBlurb: contractDocuSignEmailBlurb(contract.exhibitor_company_name, event),
      signer1: { name: newSignerName, email: newSignerEmail },
      countersigner,
      carbonCopy,
      brandId: docusignBrandIdForEvent(event),
    });
    newEnvelopeId = sent.envelopeId;

    const sentAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'sent',
        docusign_envelope_id: newEnvelopeId,
        sent_at: sentAt,
        pdf_storage_path: draftStoragePath,
        drafted_at,
      })
      .eq('id', contract.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  await supabase.from('audit_log').insert({
    contract_id: contract.id,
    actor_email: gate.session.user.email,
    action: 'docusign_resent_with_changes',
    metadata: {
      old_envelope_id: oldEnvelopeId,
      new_envelope_id: newEnvelopeId,
      old_signer_email: oldSignerEmail,
      new_signer_email: newSignerEmail,
      old_signer_name: oldSignerName,
      new_signer_name: newSignerName,
    },
  });

  revalidateContractPaths(contract.id);
  await syncExhibitorRosterWritebackById(contract.id);

  return NextResponse.json({ ok: true, envelope_id: newEnvelopeId });
}
