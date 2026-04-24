import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { calculateDiscountCents, isDiscountedRate } from '@/lib/contracts';
import { downloadCompletedPdf } from '@/lib/docusign';
import { downloadContractPdfFromStorage } from '@/lib/contract-pdf-storage';
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

/** Admin-only release after both parties signed. */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

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
  if (contract.status !== 'signed') {
    return NextResponse.json({ error: 'Release to Accounting is only available for fully signed contracts.' }, { status: 409 });
  }

  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  if (!process.env['SENDGRID_API_KEY']) {
    return NextResponse.json({ error: 'SENDGRID_API_KEY is not configured.' }, { status: 500 });
  }

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

  let signedPdfBytes: Buffer;
  try {
    signedPdfBytes = await loadSignedPdfBytes();
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  const billingSame = contract.billing_same_as_corporate ?? true;
  const billingAddressLine = billingSame
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
    countersignedByName: contract.countersigned_by_name,
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
    actor_email: gate.session.user.email,
    action: 'released_to_accounting',
    from_status: 'signed',
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
