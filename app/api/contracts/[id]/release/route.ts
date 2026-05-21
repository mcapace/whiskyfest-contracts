import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveContractActor } from '@/lib/auth-contract';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { calculateDiscountCents, isDiscountedRate } from '@/lib/contracts';
import { downloadCompletedPdf } from '@/lib/docusign';
import {
  downloadContractPdfFromStorage,
  downloadImportedContractPdf,
} from '@/lib/contract-pdf-storage';
import { sendAccountingEmail } from '@/lib/email';
import { requiresDiscountApproval } from '@/lib/contracts';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { updateContractRow } from '@/lib/sheets-tracker';
import type { ContractWithTotals, Event } from '@/types/db';

export const runtime = 'nodejs';

function appBaseUrl(): string {
  const explicit = process.env['NEXTAUTH_URL']?.replace(/\/$/, '');
  if (explicit) return explicit;
  if (process.env['VERCEL_URL']) return `https://${process.env['VERCEL_URL']}`;
  return 'http://localhost:3000';
}

/** Release to accounting: fully signed (admin) or manually imported legacy PDF (admin or events team). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const gate = await resolveContractActor(session);
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
      { error: 'Discount approval required before contract can be released.' },
      { status: 403 },
    );
  }

  const { actor } = gate;
  if (contract.status === 'imported') {
    if (!actor.isAdmin && !actor.isEventsTeam) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else if (contract.status === 'signed') {
    if (!actor.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    return NextResponse.json(
      { error: 'Release to Accounting is only available for fully signed or imported contracts.' },
      { status: 409 },
    );
  }

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  if (!process.env['SENDGRID_API_KEY']) {
    return NextResponse.json({ error: 'SENDGRID_API_KEY is not configured.' }, { status: 500 });
  }

  let signedPdfBytes: Buffer;

  if (contract.status === 'imported') {
    try {
      signedPdfBytes = await downloadImportedContractPdf(contract);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = msg.includes('missing') ? 409 : 502;
      return NextResponse.json({ error: msg }, { status });
    }
  } else {
    const envelopeIdRaw = contract.docusign_envelope_id?.trim();
    if (!envelopeIdRaw) {
      return NextResponse.json({ error: 'DocuSign contract is missing envelope id.' }, { status: 409 });
    }
    const envelopeId = envelopeIdRaw;
    if (!contract.signed_pdf_url && !contract.pdf_storage_path?.endsWith('signed.pdf')) {
      return NextResponse.json({ error: 'Signed PDF is not yet available.' }, { status: 409 });
    }

    const storagePath = contract.pdf_storage_path;
    async function loadSignedPdfBytes(): Promise<Buffer> {
      if (storagePath?.endsWith('signed.pdf')) {
        try {
          return await downloadContractPdfFromStorage(storagePath);
        } catch {
          return downloadCompletedPdf(envelopeId);
        }
      }
      return downloadCompletedPdf(envelopeId);
    }

    try {
      signedPdfBytes = await loadSignedPdfBytes();
    } catch (e: unknown) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 502 },
      );
    }
  }

  const billingSame = contract.billing_same_as_corporate ?? true;
  const exhibitorCaptured = Boolean(contract.exhibitor_fields_captured_at);
  const billingAddressLine = exhibitorCaptured
    ? [
        contract.billing_contact_name,
        contract.billing_contact_email,
        (formatBillingAddressBlock(contract) || '—').replace(/\n/g, ', '),
      ]
        .filter((x) => (x ?? '').toString().trim())
        .join(' · ')
    : billingSame
      ? (formatExhibitorAddressBlock(contract) || '—').replace(/\n/g, ', ')
      : (formatBillingAddressBlock(contract) || '—').replace(/\n/g, ', ');

  const discountCents = calculateDiscountCents(contract.booth_count, contract.booth_rate_cents);
  const discountLine =
    isDiscountedRate(contract.booth_rate_cents) && discountCents > 0 ? `${formatCurrency(discountCents)} off list` : '—';

  const now = new Date().toISOString();

  await sendAccountingEmail({
    sponsorCompanyName: contract.exhibitor_company_name,
    signerName: contract.signer_1_name,
    signerTitle: contract.signer_1_title,
    signerEmail: contract.signer_1_email,
    exhibitorTelephone: contract.exhibitor_telephone,
    billingAddressLine,
    exhibitorBillingContactName: exhibitorCaptured ? contract.billing_contact_name : null,
    exhibitorBillingContactEmail: exhibitorCaptured ? contract.billing_contact_email : null,
    exhibitorBillingAddressDetail: exhibitorCaptured ? formatBillingAddressBlock(contract) : null,
    exhibitorEventContactName: exhibitorCaptured ? contract.event_contact_name : null,
    exhibitorEventContactEmail: exhibitorCaptured ? contract.event_contact_email : null,
    eventName: event.name,
    eventYear: event.year,
    boothCount: contract.booth_count,
    boothRateCents: contract.booth_rate_cents,
    discountLine,
    boothSubtotalCents: contract.booth_subtotal_cents,
    lineItemsSubtotalCents: contract.line_items_subtotal_cents,
    grandTotalCents: contract.grand_total_cents,
    salesRepName: contract.sales_rep_name ?? null,
    executedAtFormatted: formatTimestamp(now),
    countersignedByName: contract.status === 'imported' ? null : contract.countersigned_by_name,
    signedPdfBytes,
    accountingContractUrl: `${appBaseUrl()}/accounting/${contract.id}`,
    salesRepEmail: contract.sales_rep_email ?? contract.created_by,
  });
  await supabase
    .from('contracts')
    .update({ status: 'executed', executed_at: now, accounting_notified_at: now })
    .eq('id', contract.id);

  await supabase.from('audit_log').insert({
    contract_id: contract.id,
    actor_email: actor.email,
    action: 'released_to_accounting',
    from_status: contract.status,
    to_status: 'executed',
  });

  revalidateContractPaths(contract.id);

  const { data: executedContract } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contract.id)
    .maybeSingle<ContractWithTotals>();
  if (executedContract) {
    try {
      await updateContractRow(executedContract);
    } catch (err) {
      console.error('Failed to update Sheets tracker', err);
    }
  }

  return NextResponse.json({ ok: true });
}
