import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { renderContractPdfFromTemplate } from '@/lib/google';
import { buildContractMergeMap } from '@/lib/merge-map';
import { requiresDiscountApproval } from '@/lib/contracts';
import { sendEnvelope, voidEnvelope, getCountersignerGroupId } from '@/lib/docusign';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
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
  const { data: contract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', params.id)
    .single<ContractWithTotals>();

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  if (requiresDiscountApproval(contract)) {
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

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const oldSignerEmail = contract.signer_1_email ?? null;
  const oldSignerName = contract.signer_1_name ?? null;
  const newSignerName = parsed.data.signer_1_name ?? oldSignerName;
  const newSignerEmail = parsed.data.signer_1_email ?? oldSignerEmail;

  if (!newSignerName || !newSignerEmail) {
    return NextResponse.json({ error: 'Exhibitor signer name and email are required.' }, { status: 400 });
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

  const safeCompany = contract.exhibitor_company_name.replace(/[^\w\s-]/g, '');
  const templateDocId = process.env.GOOGLE_TEMPLATE_DOC_ID!;
  const mergeMap = buildContractMergeMap(mergedContract, event, 'docusign');
  const fileName = `${safeCompany} — WhiskyFest ${event.year} Contract (DocuSign)`;

  let newEnvelopeId: string;
  try {
    let groupId: string;
    try {
      groupId = getCountersignerGroupId();
    } catch {
      return NextResponse.json({ error: 'DOCUSIGN_COUNTERSIGNER_GROUP_ID is not configured.' }, { status: 500 });
    }

    const pdfBytes = await renderContractPdfFromTemplate(templateDocId, mergeMap, fileName);

    const sent = await sendEnvelope({
      pdfBase64: pdfBytes.toString('base64'),
      documentName: `${safeCompany} — WhiskyFest ${event.year} Contract.pdf`,
      emailSubject: `Please sign: ${event.name} ${event.year} participation contract — ${contract.exhibitor_company_name}`,
      emailBlurb: `Attached is the WhiskyFest ${event.year} participation contract for ${contract.exhibitor_company_name}. Please review and sign.`,
      signer1: { name: newSignerName, email: newSignerEmail },
      countersignerSigningGroupId: groupId,
    });
    newEnvelopeId = sent.envelopeId;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const sentAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'sent',
      docusign_envelope_id: newEnvelopeId,
      sent_at: sentAt,
    })
    .eq('id', contract.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
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

  return NextResponse.json({ ok: true, envelope_id: newEnvelopeId });
}
