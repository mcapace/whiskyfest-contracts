import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatCurrency, formatTimestamp } from '@/lib/utils';
import { formatBillingAddressBlock, formatExhibitorAddressBlock } from '@/lib/exhibitor-address';
import { calculateDiscountCents, isDiscountedRate, requiresDiscountApproval } from '@/lib/contracts';
import { isLegacyImportedContract } from '@/lib/legacy-import';
import { contractHasBillingInfo } from '@/lib/nywe-billing';
import { downloadCompletedPdf } from '@/lib/docusign';
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
import type { ContractWithTotals, Event } from '@/types/db';

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
  const { contract, event, actorEmail, auditAction = 'released_to_accounting' } = options;
  const supabase = options.supabase ?? getSupabaseAdmin();

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

  if (!process.env['SENDGRID_API_KEY']) {
    return { ok: false, error: 'SENDGRID_API_KEY is not configured.', status: 500 };
  }

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
    : contractHasBillingInfo(contract)
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
    exhibitorBillingContactName:
      exhibitorCaptured || contractHasBillingInfo(contract) ? contract.billing_contact_name : null,
    exhibitorBillingContactEmail:
      exhibitorCaptured || contractHasBillingInfo(contract) ? contract.billing_contact_email : null,
    exhibitorBillingAddressDetail:
      exhibitorCaptured || contractHasBillingInfo(contract) ? formatBillingAddressBlock(contract) : null,
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

  await supabase
    .from('contracts')
    .update({ status: 'executed', executed_at: now, accounting_notified_at: now })
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
