import sgMail from '@sendgrid/mail';
import {
  formatEventDisplayName,
  sendGridFromForProduct,
  workspaceLabelForProduct,
} from '@/lib/product-email';
import { PRODUCT_BIG_SMOKE, PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import { formatInvoiceStatus } from '@/lib/invoice-status';

/**
 * Accounting handoff email (SendGrid).
 *
 * SENDGRID_API_KEY, ACCOUNTING_HANDOFF_EMAIL (single TO on executed handoff; defaults to accountsreceivable@mshanken.com)
 * Legacy ACCOUNTING_EMAILS / ACCOUNTING_EMAIL are not used for executed-contract emails.
 */

export interface AccountingEmailPayload {
  contractId: string;
  sponsorCompanyName: string;
  /** Legal entity on the contract — typically the bill-to company for invoicing. */
  exhibitorLegalName: string;
  signerName: string | null;
  signerTitle: string | null;
  signerEmail: string | null;
  exhibitorTelephone: string | null;
  /** Single-line billing / invoice mailing address for the summary table (legacy or condensed). */
  billingAddressLine: string;
  /** Corporate / mailing address from exhibitor DocuSign tabs when captured. */
  exhibitorMailingAddress?: string | null;
  /** Invoice workflow flag at release (pending, not_invoiced, etc.). */
  invoiceStatusLabel: string;
  /** Sponsor brand(s) or NYWE roster company label when present. */
  brandsPoured?: string | null;
  /** Human-readable deal type for AR context. */
  orderTypeLabel: string;
  lineItems?: { description: string; amountCents: number }[];
  /** NYWE vendor license vs WhiskyFest booth package. */
  isNyweVendor?: boolean;
  /** Set when exhibitor DocuSign tabs populated `exhibitor_fields_captured_at`. */
  exhibitorBillingContactName?: string | null;
  exhibitorBillingContactEmail?: string | null;
  /** Bill-to company for invoicing (legal name or display company). */
  billingCompanyName?: string | null;
  /** Multiline billing address (HTML uses <br/>). */
  exhibitorBillingAddressDetail?: string | null;
  exhibitorEventContactName?: string | null;
  exhibitorEventContactEmail?: string | null;
  eventName: string;
  eventYear: number;
  boothCount: number;
  boothRateCents: number;
  /** Human-readable discount row, e.g. "$500 off list" or "—" */
  discountLine: string;
  /** Booth package subtotal (booth count × rate). */
  boothSubtotalCents: number;
  /** Sum of optional line items; omit or zero when none. */
  lineItemsSubtotalCents?: number;
  grandTotalCents: number;
  salesRepName: string | null;
  executedAtFormatted: string;
  countersignedByName: string | null;
  signedPdfBytes: Buffer;
  /** Primary CTA: AR workspace contract detail. */
  accountingContractUrl: string;
  /** Sales rep email for CC (from sales_reps). */
  salesRepEmail?: string | null;
  /** whiskyfest | wine_spectator — controls SendGrid from-name and PDF label. */
  productKey?: string;
}

function formatCents(n: number): string {
  return `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function accountingHandoffRecipients(): string[] {
  const email =
    process.env['ACCOUNTING_HANDOFF_EMAIL']?.trim().toLowerCase() ||
    process.env['ACCOUNTING_EMAIL']?.trim().toLowerCase()?.split(',')[0]?.trim() ||
    'accountsreceivable@mshanken.com';
  return email ? [email] : ['accountsreceivable@mshanken.com'];
}

export async function sendAccountingEmail(p: AccountingEmailPayload): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  const isWine = p.productKey === PRODUCT_WINE_SPECTATOR;
  const isBigSmoke = p.productKey === PRODUCT_BIG_SMOKE;
  const productFrom = sendGridFromForProduct(p.productKey);
  // Wine Spectator uses its verified NYWE sender. WhiskyFest + Big Smoke accounting
  // handoffs use ACCOUNTING_FROM_EMAIL (verified on SendGrid); Big Smoke still shows
  // as "Big Smoke Contracts" via from-name.
  const fromAddress = isWine
    ? productFrom.email
    : process.env['ACCOUNTING_FROM_EMAIL']?.trim() || productFrom.email;
  const fromName = productFrom.name;
  const workspaceLabel = workspaceLabelForProduct(p.productKey);
  const eventDisplay = formatEventDisplayName(p.eventName, p.eventYear);

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not set — cannot send accounting email');
  }

  sgMail.setApiKey(apiKey);

  const recipients = accountingHandoffRecipients();
  const doNotInvoice = p.invoiceStatusLabel === formatInvoiceStatus('not_invoiced');
  const subject = doNotInvoice
    ? `Contract Executed: ${p.sponsorCompanyName} — Do Not Invoice`
    : `Contract Executed: ${p.sponsorCompanyName} — Ready for Invoicing`;

  const signerLine = [p.signerName, p.signerTitle].filter(Boolean).join(', ') || '—';
  const intro = isWine
    ? 'An NY Wine Experience vendor license has been executed and is ready for accounting.'
    : isBigSmoke
      ? 'A Big Smoke exhibitor contract has been executed and is ready for accounting.'
      : 'A WhiskyFest sponsor contract has been executed and is ready for accounting.';
  const flatFeeLabel = isWine ? 'License fee' : isBigSmoke ? 'Package fee' : 'License fee';

  const li = p.lineItemsSubtotalCents ?? 0;
  const lineItemRows = (p.lineItems ?? []).filter((row) => row.description.trim());
  const amountLines =
    p.isNyweVendor
      ? [`${flatFeeLabel}: ${formatCents(p.grandTotalCents)}`]
      : li > 0
        ? [
            `Booth package: ${formatCents(p.boothSubtotalCents)}`,
            ...lineItemRows.map((row) => `  · ${row.description}: ${formatCents(row.amountCents)}`),
            `Total: ${formatCents(p.grandTotalCents)}`,
          ]
        : [`Total: ${formatCents(p.grandTotalCents)}`];

  const hasDesignatedBilling = Boolean(p.exhibitorBillingContactName?.trim() && p.exhibitorBillingContactEmail?.trim());
  const mailingAddress = p.exhibitorMailingAddress?.trim() || null;
  const billingAddressDetail = p.exhibitorBillingAddressDetail?.trim() || null;

  const accountSection = [
    `ACCOUNT / CLIENT`,
    `Display name: ${p.sponsorCompanyName}`,
    `Legal / bill-to name: ${p.exhibitorLegalName}`,
    ...(p.brandsPoured?.trim() ? [`Brand / program: ${p.brandsPoured.trim()}`] : []),
    `Deal type: ${p.orderTypeLabel}`,
    `Contract ID: ${p.contractId}`,
    `AR status: ${p.invoiceStatusLabel}${doNotInvoice ? ' (complimentary — do not send invoice)' : ''}`,
  ];

  const billingSection = [
    ``,
    `DESIGNATED BILLING (EXHIBITOR)`,
    ...(hasDesignatedBilling
      ? [
          `Billing contact: ${p.exhibitorBillingContactName ?? '—'}`,
          `Billing email: ${p.exhibitorBillingContactEmail ?? '—'}`,
          `Billing company: ${p.billingCompanyName?.trim() || '—'}`,
          ...(billingAddressDetail
            ? ['Billing address:', ...billingAddressDetail.split('\n').map((ln) => `  ${ln.trim()}`).filter(Boolean)]
            : [`Billing address: ${p.billingAddressLine}`]),
        ]
      : [`Billing summary: ${p.billingAddressLine}`]),
    ...(mailingAddress
      ? [
          `Corporate / mailing address:`,
          ...mailingAddress.split('\n').map((ln) => `  ${ln.trim()}`).filter(Boolean),
        ]
      : []),
    ...(p.exhibitorEventContactName?.trim() || p.exhibitorEventContactEmail?.trim()
      ? [
          `Event contact: ${p.exhibitorEventContactName?.trim() || '—'}`,
          `Event email: ${p.exhibitorEventContactEmail ?? '—'}`,
        ]
      : []),
  ];

  const contractSection = [
    ``,
    `CONTRACT / SIGNER`,
    `Signer: ${signerLine}`,
    `Signer email: ${p.signerEmail ?? '—'}`,
    `Phone: ${p.exhibitorTelephone ?? '—'}`,
    `Event: ${eventDisplay}`,
    ...(p.isNyweVendor
      ? []
      : [
          `Booth count: ${p.boothCount}`,
          `Booth rate: ${formatCents(p.boothRateCents)}`,
          `Discount: ${p.discountLine}`,
        ]),
    ...amountLines,
    `Sales rep: ${p.salesRepName ?? '—'}${p.salesRepEmail ? ` (${p.salesRepEmail})` : ''}`,
    `Executed: ${p.executedAtFormatted}`,
    `Countersigner: ${p.countersignedByName ?? '—'}`,
    ``,
    `View in ${workspaceLabel}: ${p.accountingContractUrl}`,
  ];

  const text = [intro, ``, ...accountSection, ...billingSection, ...contractSection].join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;border:1px solid #e5e5e5;color:#666;width:180px;vertical-align:top;">${escape(label)}</td>` +
    `<td style="padding:8px 12px;border:1px solid #e5e5e5;vertical-align:top;">${value}</td></tr>`;

  const sectionHeader = (title: string) =>
    `<tr><td colspan="2" style="padding:10px 12px;background:#f3f4f6;border:1px solid #e5e5e5;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">${escape(title)}</td></tr>`;

  const multilineCell = (raw: string | null | undefined) => {
    const trimmed = raw?.trim();
    if (!trimmed) return '—';
    return escape(trimmed).replace(/\n/g, '<br/>');
  };

  const invoiceStatusHtml = doNotInvoice
    ? `<strong style="color:#5b21b6;">${escape(p.invoiceStatusLabel)}</strong> — complimentary; do not send invoice`
    : escape(p.invoiceStatusLabel);

  const designatedBillingHtml = [
    sectionHeader('Designated billing (exhibitor)'),
    ...(hasDesignatedBilling
      ? [
          row('Billing contact', escape(p.exhibitorBillingContactName ?? '—')),
          row(
            'Billing email',
            p.exhibitorBillingContactEmail
              ? `<a href="mailto:${escape(p.exhibitorBillingContactEmail)}">${escape(p.exhibitorBillingContactEmail)}</a>`
              : '—',
          ),
          row('Billing company', escape(p.billingCompanyName?.trim() || '—')),
          row('Billing address', multilineCell(p.exhibitorBillingAddressDetail)),
        ]
      : [row('Billing summary', escape(p.billingAddressLine))]),
    ...(mailingAddress ? [row('Corporate / mailing address', multilineCell(mailingAddress))] : []),
    ...(p.exhibitorEventContactName?.trim() || p.exhibitorEventContactEmail?.trim()
      ? [
          row('Event contact', escape(p.exhibitorEventContactName?.trim() || '—')),
          row(
            'Event email',
            p.exhibitorEventContactEmail?.trim()
              ? `<a href="mailto:${escape(p.exhibitorEventContactEmail.trim())}">${escape(p.exhibitorEventContactEmail.trim())}</a>`
              : '—',
          ),
        ]
      : []),
  ].join('');

  const lineItemsHtml =
    lineItemRows.length > 0
      ? row(
          'Line items',
          lineItemRows
            .map(
              (item) =>
                `${escape(item.description)} — <strong>${escape(formatCents(item.amountCents))}</strong>`,
            )
            .join('<br/>'),
        )
      : '';

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 680px;">
      <p style="font-size:15px;line-height:1.5;">${escape(intro)}</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tbody>
          ${sectionHeader('Account / client')}
          ${row('Display name', escape(p.sponsorCompanyName))}
          ${row('Legal / bill-to name', escape(p.exhibitorLegalName))}
          ${p.brandsPoured?.trim() ? row('Brand / program', escape(p.brandsPoured.trim())) : ''}
          ${row('Deal type', escape(p.orderTypeLabel))}
          ${row('Contract ID', `<span style="font-family:ui-monospace,monospace;font-size:12px;">${escape(p.contractId)}</span>`)}
          ${row('AR status', invoiceStatusHtml)}
          ${designatedBillingHtml}
          ${sectionHeader('Contract / signer')}
          ${row('Signer', escape(signerLine))}
          ${row('Email', p.signerEmail ? `<a href="mailto:${escape(p.signerEmail)}">${escape(p.signerEmail)}</a>` : '—')}
          ${row('Phone', escape(p.exhibitorTelephone ?? '—'))}
          ${row('Event', escape(eventDisplay))}
          ${
            p.isNyweVendor
              ? row(flatFeeLabel, escape(formatCents(p.grandTotalCents)))
              : row('Booth count', escape(String(p.boothCount))) +
                row('Booth rate', escape(formatCents(p.boothRateCents))) +
                row('Discount', escape(p.discountLine)) +
                row('Booth package', escape(formatCents(p.boothSubtotalCents))) +
                lineItemsHtml +
                row('Total', escape(formatCents(p.grandTotalCents)))
          }
          ${row('Sales rep', escape([p.salesRepName, p.salesRepEmail].filter(Boolean).join(' · ') || '—'))}
          ${row('Executed', escape(p.executedAtFormatted))}
          ${row('Countersigner', escape(p.countersignedByName ?? '—'))}
        </tbody>
      </table>
      <p style="margin:24px 0;">
        <a href="${escape(p.accountingContractUrl)}"
           style="display:inline-block;padding:12px 20px;background:#6b3822;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          View in ${escape(workspaceLabel)}
        </a>
      </p>
      <p style="color:#666;font-size:13px;">— ${escape(workspaceLabel)}</p>
    </div>
  `;

  await sgMail.send({
    from: { email: fromAddress, name: fromName },
    to: recipients,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `${p.sponsorCompanyName} — ${
          isWine ? eventDisplay : isBigSmoke ? eventDisplay : `WhiskyFest ${p.eventYear}`
        } Contract (SIGNED).pdf`,
        content: p.signedPdfBytes.toString('base64'),
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  });
}
