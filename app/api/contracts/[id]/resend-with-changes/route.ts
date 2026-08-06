import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminOrProductContractAdmin } from '@/lib/api-auth';
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
import { contractUsesOrderTable } from '@/lib/contract-template-profile';
import {
  countersignerRequiredForEvent,
  countersignCcValidation,
  resolveDocuSignCountersignDelivery,
  toSendEnvelopeCountersignParams,
} from '@/lib/docusign-envelope-recipients';
import { nyweLicenseAddressError } from '@/lib/nywe-billing';
import { refreshNyweBillingFromRosterForContract } from '@/lib/nywe-roster-billing-sync';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { fetchContractWithTotalsById } from '@/lib/contract-with-totals';
import { buildContractMergeMap } from '@/lib/merge-map';
import { requiresDiscountApproval } from '@/lib/contracts';
import {
  fetchEnvelopeStatus,
  formatDocuSignErrorForUser,
  sendEnvelope,
  voidEnvelope,
} from '@/lib/docusign';
import { syncExhibitorRosterWritebackById } from '@/lib/exhibitor-roster-sync-hook';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { docusignBrandIdForEvent } from '@/lib/product-email';
import { parseSignerCc } from '@/lib/docusign-signer-cc';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';
/** Void + Google PDF render + new DocuSign send — needs more than the default serverless limit. */
export const maxDuration = 120;

const schema = z.object({
  signer_1_name: z.string().trim().min(1).optional(),
  signer_1_email: z.string().trim().email().optional(),
});

function errMessage(e: unknown): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  return String(e);
}

/**
 * Admin / product admin: void old DocuSign contract, apply optional signer corrections, send a new envelope.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdminOrProductContractAdmin(params.id);
  if (!gate.ok) return gate.res;

  try {
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

    // Sheets quota/network must not block a signer email correction.
    try {
      contract = await refreshNyweBillingFromRosterForContract(supabase, contract, event);
    } catch (refreshErr) {
      console.warn(
        '[resend-with-changes] roster refresh skipped',
        params.id,
        refreshErr instanceof Error ? refreshErr.message : refreshErr,
      );
    }

    if (requiresDiscountApproval(contract, event)) {
      return NextResponse.json(
        { error: 'Discount approval required before contract can be sent to DocuSign.' },
        { status: 403 },
      );
    }
    // `error` covers declined/voided envelopes (e.g. wrong signer declined) so we can send a fresh envelope.
    if (contract.status !== 'sent' && contract.status !== 'partially_signed' && contract.status !== 'error') {
      return NextResponse.json(
        {
          error:
            'Resend with Changes is only available while the DocuSign contract is sent, partially signed, or in error after a declined/voided envelope.',
        },
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
      const { status: envelopeStatus } = await fetchEnvelopeStatus(oldEnvelopeId);
      const envLower = envelopeStatus.toLowerCase();
      if (envLower !== 'voided' && envLower !== 'declined') {
        await voidEnvelope(oldEnvelopeId, `Resent with updated info — ${gate.session.user.email}`);
      }
    } catch (e: unknown) {
      const msg = errMessage(e);
      // Already terminal envelopes sometimes reject void; still allow a new send.
      if (!/voided|declined|completed|complete/i.test(msg)) {
        return NextResponse.json(
          { error: formatDocuSignErrorForUser(msg) || msg },
          { status: 502 },
        );
      }
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

    let templateDocId: string;
    try {
      templateDocId = resolveContractTemplateDocId(mergedContract, event);
    } catch (e: unknown) {
      return NextResponse.json({ error: errMessage(e) }, { status: 500 });
    }

    const mergeMap = buildContractMergeMap(mergedContract, event, 'docusign', boothBrands);
    const fileName = `${contractPdfBaseName(contract.exhibitor_company_name, event)} (DocuSign)`;
    const usesOrderTable = contractUsesOrderTable(event, mergedContract);

    let newEnvelopeId: string;
    try {
      const countersignDelivery = await resolveDocuSignCountersignDelivery(event);
      if (countersignerRequiredForEvent(event) && !countersignDelivery) {
        return NextResponse.json({ error: 'Event countersigner name and email are required.' }, { status: 500 });
      }

      const carbonCopy = parseSignerCc(mergedContract);
      const ccError = countersignCcValidation({
        signerEmail: newSignerEmail,
        delivery: countersignDelivery,
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
        ...toSendEnvelopeCountersignParams(countersignDelivery),
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
          notes: null,
        })
        .eq('id', contract.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } catch (e: unknown) {
      const msg = errMessage(e);
      return NextResponse.json(
        { error: formatDocuSignErrorForUser(msg) || msg },
        { status: 502 },
      );
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
    try {
      await syncExhibitorRosterWritebackById(contract.id);
    } catch (writebackErr) {
      console.warn(
        '[resend-with-changes] roster writeback skipped',
        contract.id,
        writebackErr instanceof Error ? writebackErr.message : writebackErr,
      );
    }

    return NextResponse.json({ ok: true, envelope_id: newEnvelopeId });
  } catch (e: unknown) {
    const msg = errMessage(e);
    console.error('[resend-with-changes] unexpected', params.id, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
