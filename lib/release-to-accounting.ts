import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { calculateDiscountCents, isDiscountedRate, requiresDiscountApproval } from '@/lib/contracts';
import { fetchContractLineItemsOrdered } from '@/lib/contract-line-items';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import { formatInvoiceStatus } from '@/lib/invoice-status';
import { isLegacyImportedContract } from '@/lib/legacy-import';
import { isNoChargeBoothContract } from '@/lib/no-charge-booth';
import { contractHasBillingInfo } from '@/lib/nywe-billing';
import { isNyweVendorEvent } from '@/lib/nywe-pricing';
import { downloadCompletedPdf } from '@/lib/docusign';
import { fetchExhibitorCaptureFromEnvelope } from '@/lib/docusign-exhibitor-capture';
import {
  downloadContractPdfFromStorage,
  downloadImportedContractPdf,
} from '@/lib/contract-pdf-storage';
import { sendAccountingEmail } from '@/lib/email';
import { accountingContractUrl } from '@/lib/product-email';
import { productKeyFromEvent } from '@/lib/product-portal';
import { revalidateContractPaths } from '@/lib/revalidate-contract-paths';
import { updateContractRow } from '@/lib/sheets-tracker';
import { syncExhibitorRosterWriteback } from '@/lib/exhibitor-roster-sync-hook';
import { insertContractAudit } from '@/lib/audit-log';
import type { ContractWithTotals, Event } from '@/types/db';

/** Shown when AR email has no designated billing_* — never substitute corporate mailing. */
export const BILLING_NOT_CAPTURED_MESSAGE =
  'Not captured in system — invoice from the signed PDF (or billing Excel). Corporate mailing below is not designated billing.';

async function ensureExhibitorCaptureBeforeRelease(
  supabase: SupabaseClient,
  contract: ContractWithTotals,
  actorEmail: string,
): Promise<ContractWithTotals> {
  if (contract.exhibitor_fields_captured_at) return contract;
  if (isLegacyImportedContract(contract)) return contract;

  const envelopeId = contract.docusign_envelope_id?.trim();
  if (!envelopeId) return contract;

  const capture = await fetchExhibitorCaptureFromEnvelope(envelopeId);
  if (!capture) return contract;

  const { error } = await supabase.from('contracts').update(capture).eq('id', contract.id);
  if (error) {
    console.error('[release-to-accounting] late exhibitor capture failed', contract.id, error.message);
    return contract;
  }

  await insertContractAudit(supabase, {
    contract_id: contract.id,
    actor_email: actorEmail,
    action: 'exhibitor_fields_captured',
    metadata: {
      envelope_id: envelopeId,
      source: 'late_capture_on_release',
    },
  });

  const { data: refreshed } = await supabase
    .from('contracts_with_totals')
    .select('*')
    .eq('id', contract.id)
    .maybeSingle<ContractWithTotals>();

  return refreshed ?? { ...contract, ...capture };
}

export type ReleaseToAccountingResult =
  | { ok: true; executedAt: string }
  | { ok: false; error: string; status: number };

/** Shared release handoff — used by API route and NYWE auto-release after countersign. */
export async function releaseContractToAccounting(options: {
  contract: ContractWithTotals;
  event: Event;
  actorEmail: string;
  auditAction?: 'released_to_accounting' | 'auto_released_to_accounting';
  supabase?: SupabaseClient;
}): Promise<ReleaseToAccountingResult> {
  const { event, actorEmail, auditAction = 'released_to_accounting' } = options;
  const supabase = options.supabase ?? getSupabaseAdmin();
  let contract = options.contract;

  if (requiresDiscountApproval(contract, event)) {
    return { ok: false, error: 'Discount approval required before contract can be released.', status: 403 };
  }

  if (contract.status !== 'signed') {
    if (contract.status === 'imported') {
      return {
        ok: false,
        error: 'Approve this legacy import before releasing to accounting.',
        status: 409,
      };
    }
    return {
      ok: false,
      error: 'Release to Accounting is only available for fully signed contracts.',
      status: 409,
    };
  }

  if (isLegacyImportedContract(contract) && !contract.events_approved_at) {
    return {
      ok: false,
      error: 'Events approval required before legacy import can be released to accounting.',
      status: 403,
    };
  }

  if (contract.accounting_notified_at) {
    return { ok: false, error: 'Already released to accounting.', status: 409 };
  }

  if (!process.env['SENDGRID_API_KEY']) {
    return { ok: false, error: 'SENDGRID_API_KEY is not configured.', status: 500 };
  }

  // Last chance to sync DocuSign billing tabs into DB before the AR email is composed.
  contract = await ensureExhibitorCaptureBeforeRelease(supabase, contract, actorEmail);

  let signedPdfBytes: Buffer;

  if (isLegacyImportedContract(contract)) {
    try {
      signedPdfBytes = await downloadImportedContractPdf(contract);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg, status: msg.includes('missing') ? 409 : 502 };
    }
  } else {
    const envelopeIdRaw = contract.docusign_envelope_id?.trim();
    if (!envelopeIdRaw) {
      return { ok: false, error: 'DocuSign contract is missing envelope id.', status: 409 };
    }
    if (!contract.signed_pdf_url && !contract.pdf_storage_path?.endsWith('signed.pdf')) {
      return { ok: false, error: 'Signed PDF is not yet available.', status: 409 };
    }

    const envelopeId = envelopeIdRaw;
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
      return { ok: false, error: e instanceof Error ? e.message : String(e), status: 502 };
    }
  }

  const exhibitorCaptured = Boolean(contract.exhibitor_fields_captured_at);
  const hasDesignatedBilling = exhibitorCaptured || contractHasBillingInfo(contract);
  const billingAddressLine = hasDesignatedBilling
    ? [
        contract.billing_contact_name,
        contract.billing_contact_email,
        (formatBillingAddressBlock(contract) || '—').replace(/\n/g, ', '),
      ]
        .filter((x) => (x ?? '').toString().trim())
        .join(' · ')
    : BILLING_NOT_CAPTURED_MESSAGE;

  const billingCompanyName =
    contract.exhibitor_legal_name?.trim() || contract.exhibitor_company_name?.trim() || null;

  const discountCents = calculateDiscountCents(contract.booth_count, contract.booth_rate_cents, event);
  const discountLine =
    isDiscountedRate(contract.booth_rate_cents, event) && discountCents > 0
      ? `${formatCurrency(discountCents)} off list`
      : '—';

  const nyweVendor = isNyweVendorEvent(event);
  const lineItemRows = await fetchContractLineItemsOrdered(supabase, contract.id);
  const exhibitorMailingAddress = formatExhibitorAddressBlock(contract) || null;

  const invoiceStatusLabel = isNoChargeBoothContract(contract)
    ? formatInvoiceStatus('not_invoiced')
    : formatInvoiceStatus(contract.invoice_status ?? 'pending');

  const orderTypeLabel = nyweVendor
    ? 'NYWE vendor license'
    : isSponsorshipOnlyOrder(contract)
      ? 'Sponsorship only'
      : lineItemRows.length > 0
        ? 'Booth + sponsorship / line items'
        : 'Booth package';

  const now = new Date().toISOString();

  // One email per contract — claim before SendGrid so webhook + cron + dashboard cannot duplicate.
  const { data: claimed, error: claimError } = await supabase
    .from('contracts')
    .update({ accounting_notified_at: now })
    .eq('id', contract.id)
    .eq('status', contract.status)
    .is('accounting_notified_at', null)
    .select('id')
    .maybeSingle();

  if (claimError) {
    return { ok: false, error: claimError.message, status: 500 };
  }
  if (!claimed) {
    return { ok: false, error: 'Already released to accounting.', status: 409 };
  }

  try {
    await sendAccountingEmail({
    contractId: contract.id,
    sponsorCompanyName: contract.exhibitor_company_name,
    exhibitorLegalName: contract.exhibitor_legal_name,
    signerName: contract.signer_1_name,
    signerTitle: contract.signer_1_title,
    signerEmail: contract.signer_1_email,
    exhibitorTelephone: contract.exhibitor_telephone,
    billingAddressLine,
    exhibitorMailingAddress,
    invoiceStatusLabel,
    brandsPoured: contract.brands_poured,
    orderTypeLabel,
    lineItems: lineItemRows.map((row) => ({
      description: row.description,
      amountCents: row.amount_cents,
    })),
    isNyweVendor: nyweVendor,
    exhibitorBillingContactName: hasDesignatedBilling ? contract.billing_contact_name : null,
    exhibitorBillingContactEmail: hasDesignatedBilling ? contract.billing_contact_email : null,
    billingCompanyName,
    exhibitorBillingAddressDetail: hasDesignatedBilling
      ? formatBillingAddressBlock(contract)
      : null,
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
    countersignedByName: isLegacyImportedContract(contract) ? null : contract.countersigned_by_name,
    signedPdfBytes,
    accountingContractUrl: accountingContractUrl(contract.id, productKeyFromEvent(event)),
    salesRepEmail: contract.sales_rep_email ?? contract.created_by,
    productKey: event.product_key,
    });
  } catch (err) {
    await supabase
      .from('contracts')
      .update({ accounting_notified_at: null })
      .eq('id', contract.id)
      .eq('status', contract.status);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, status: 502 };
  }

  await supabase
    .from('contracts')
    .update({ status: 'executed', executed_at: now })
    .eq('id', contract.id);

  await supabase.from('audit_log').insert({
    contract_id: contract.id,
    actor_email: actorEmail,
    action: auditAction,
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
    await syncExhibitorRosterWriteback(executedContract);
  }

  return { ok: true, executedAt: now };
}
