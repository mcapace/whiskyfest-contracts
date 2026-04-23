import sgMail from '@sendgrid/mail';

/**
 * Accounting handoff email (SendGrid).
 *
 * SENDGRID_API_KEY, ACCOUNTING_EMAILS (comma-separated), ACCOUNTING_FROM_EMAIL
 * Falls back to legacy ACCOUNTING_EMAIL if ACCOUNTING_EMAILS is unset.
 */

export interface AccountingEmailPayload {
  sponsorCompanyName: string;
  signerName: string | null;
  signerTitle: string | null;
  signerEmail: string | null;
  exhibitorTelephone: string | null;
  /** Single-line billing / invoice mailing address for the summary table. */
  billingAddressLine: string;
  eventName: string;
  eventYear: number;
  boothCount: number;
  boothRateCents: number;
  /** Human-readable discount row, e.g. "$500 off list" or "—" */
  discountLine: string;
  grandTotalCents: number;
  salesRepName: string | null;
  executedAtFormatted: string;
  countersignedByName: string | null;
  signedPdfBytes: Buffer;
  /** Primary CTA: AR workspace contract detail. */
  accountingContractUrl: string;
  /** Sales rep email for CC (from sales_reps). */
  salesRepEmail?: string | null;
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

function accountingToRecipients(): string[] {
  const raw =
    process.env['ACCOUNTING_EMAILS']?.trim() ||
    process.env['ACCOUNTING_EMAIL']?.trim() ||
    'accountsreceivable@mshanken.com,dbixler@mshanken.com';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function sendAccountingEmail(p: AccountingEmailPayload): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  const fromAddress = process.env['ACCOUNTING_FROM_EMAIL'] ?? 'contracts@mshanken.com';
  const fromName = 'WhiskyFest Contracts';

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not set — cannot send accounting email');
  }

  sgMail.setApiKey(apiKey);

  const recipients = accountingToRecipients();
  const subject = `Contract Executed: ${p.sponsorCompanyName} — Ready for Invoicing`;

  const signerLine = [p.signerName, p.signerTitle].filter(Boolean).join(', ') || '—';

  const text = [
    `A new contract has been executed and is ready for invoicing.`,
    ``,
    `Sponsor: ${p.sponsorCompanyName}`,
    `Signer: ${signerLine}`,
    `Email: ${p.signerEmail ?? '—'}`,
    `Phone: ${p.exhibitorTelephone ?? '—'}`,
    `Billing Address: ${p.billingAddressLine}`,
    `Event: ${p.eventName} ${p.eventYear}`,
    `Booth Count: ${p.boothCount}`,
    `Booth Rate: ${formatCents(p.boothRateCents)}`,
    `Discount: ${p.discountLine}`,
    `Total: ${formatCents(p.grandTotalCents)}`,
    `Sales Rep: ${p.salesRepName ?? '—'}`,
    `Executed Date: ${p.executedAtFormatted}`,
    `Countersigner: ${p.countersignedByName ?? '—'}`,
    ``,
    `View in WhiskyFest Contracts: ${p.accountingContractUrl}`,
  ].join('\n');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;border:1px solid #e5e5e5;color:#666;width:160px;">${escape(label)}</td>` +
    `<td style="padding:8px 12px;border:1px solid #e5e5e5;">${value}</td></tr>`;

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 640px;">
      <p style="font-size:15px;">A new contract has been executed and is ready for invoicing.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tbody>
          ${row('Sponsor', escape(p.sponsorCompanyName))}
          ${row('Signer', escape(signerLine))}
          ${row('Email', p.signerEmail ? `<a href="mailto:${escape(p.signerEmail)}">${escape(p.signerEmail)}</a>` : '—')}
          ${row('Phone', escape(p.exhibitorTelephone ?? '—'))}
          ${row('Billing Address', escape(p.billingAddressLine))}
          ${row('Event', escape(`${p.eventName} ${p.eventYear}`))}
          ${row('Booth Count', escape(String(p.boothCount)))}
          ${row('Booth Rate', escape(formatCents(p.boothRateCents)))}
          ${row('Discount', escape(p.discountLine))}
          ${row('Total', escape(formatCents(p.grandTotalCents)))}
          ${row('Sales Rep', escape(p.salesRepName ?? '—'))}
          ${row('Executed Date', escape(p.executedAtFormatted))}
          ${row('Countersigner', escape(p.countersignedByName ?? '—'))}
        </tbody>
      </table>
      <p style="margin:24px 0;">
        <a href="${escape(p.accountingContractUrl)}"
           style="display:inline-block;padding:12px 20px;background:#6b3822;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          View in WhiskyFest Contracts
        </a>
      </p>
      <p style="color:#666;font-size:13px;">— WhiskyFest Contracts</p>
    </div>
  `;

  const sales = p.salesRepEmail?.trim();
  const cc =
    sales && !recipients.map((r) => r.toLowerCase()).includes(sales.toLowerCase())
      ? [sales]
      : undefined;

  await sgMail.send({
    from: { email: fromAddress, name: fromName },
    to: recipients,
    cc,
    subject,
    text,
    html,
    attachments: [
      {
        filename: `${p.sponsorCompanyName} — WhiskyFest ${p.eventYear} Contract (SIGNED).pdf`,
        content: p.signedPdfBytes.toString('base64'),
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  });
}
