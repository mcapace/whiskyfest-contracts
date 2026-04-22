import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatLongDate } from '@/lib/utils';
import { formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { downloadCompletedPdf } from '@/lib/docusign';
import { sendAccountingEmail } from '@/lib/email';
import { requiresDiscountApproval } from '@/lib/contracts';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
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

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) {
    return NextResponse.json({ error: 'DocuSign contract is missing envelope id.' }, { status: 409 });
  }
  if (!contract.signed_pdf_url) {
    return NextResponse.json({ error: 'Signed PDF is not yet available.' }, { status: 409 });
  }

  let signedPdfBytes: Buffer;
  try {
    signedPdfBytes = await downloadCompletedPdf(envelopeId);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  await sendAccountingEmail({
    exhibitorCompanyName: contract.exhibitor_company_name,
    exhibitorLegalName: contract.exhibitor_legal_name,
    eventName: event.name,
    eventDate: formatLongDate(event.event_date),
    eventYear: event.year,
    boothCount: contract.booth_count,
    boothRateCents: contract.booth_rate_cents,
    additionalBrandCount: contract.additional_brand_count,
    grandTotalCents: contract.grand_total_cents,
    signerName: contract.signer_1_name,
    signerTitle: contract.signer_1_title,
    signerEmail: contract.signer_1_email,
    exhibitorTelephone: contract.exhibitor_telephone,
    exhibitorAddress: formatExhibitorAddressBlock(contract),
    signedPdfUrl: contract.signed_pdf_url,
    signedPdfBytes,
    contractId: contract.id,
    dashboardUrl: `${appBaseUrl()}/contracts/${contract.id}`,
    salesRepEmail: contract.sales_rep_email ?? contract.created_by,
  });

  const now = new Date().toISOString();
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

  return NextResponse.json({ ok: true });
}
