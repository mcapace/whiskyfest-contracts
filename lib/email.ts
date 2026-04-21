import sgMail from '@sendgrid/mail';

/**
 * Accounting handoff email (SendGrid).
 *
 * SENDGRID_API_KEY, ACCOUNTING_EMAIL, ACCOUNTING_FROM_EMAIL
 */

export interface AccountingEmailPayload {
  exhibitorCompanyName: string;
  exhibitorLegalName: string;
  eventName: string;
  eventDate: string;
  eventYear: number;
  boothCount: number;
  boothRateCents: number;
  additionalBrandCount: number;
  grandTotalCents: number;
  signerName: string | null;
  signerTitle: string | null;
  signerEmail: string | null;
  exhibitorTelephone: string | null;
  exhibitorAddress: string | null;
  signedPdfUrl: string;
  signedPdfBytes: Buffer;
  contractId: string;
  dashboardUrl: string;
  /** Sales rep who created the contract in the app — CC’d on the executed-contract handoff (same content as accounting). */
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

export async function sendAccountingEmail(p: AccountingEmailPayload): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  const toAddress = process.env['ACCOUNTING_EMAIL'] ?? 'accounting@mshanken.com';
  const fromAddress = process.env['ACCOUNTING_FROM_EMAIL'] ?? 'contracts@mshanken.com';
  const fromName = 'WhiskyFest Contracts';

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not set — cannot send accounting email');
  }

  sgMail.setApiKey(apiKey);

  const subject = `[${p.eventName} ${p.eventYear}] Executed contract — ${p.exhibitorCompanyName} — ${formatCents(p.grandTotalCents)}`;

  const text = [
    `New executed WhiskyFest contract — ready for invoicing.`,
    ``,
    `Exhibitor:         ${p.exhibitorCompanyName}`,
    `Legal name:        ${p.exhibitorLegalName}`,
    `Event:             ${p.eventName} — ${p.eventDate}`,
    ``,
    `Booth count:       ${p.boothCount} @ ${formatCents(p.boothRateCents)}`,
    `Additional brands: ${p.additionalBrandCount} @ $300`,
    `GRAND TOTAL:       ${formatCents(p.grandTotalCents)}`,
    `Payment terms:     Due upon receipt (Net 30 for discount)`,
    ``,
    `Billing contact:   ${p.signerName ?? '—'}${p.signerTitle ? ', ' + p.signerTitle : ''}`,
    `                   ${p.signerEmail ?? '—'}`,
    `                   ${p.exhibitorTelephone ?? '—'}`,
    `Billing address:   ${p.exhibitorAddress ?? '—'}`,
    ``,
    `Signed PDF:        ${p.signedPdfUrl}`,
    `Contract record:   ${p.dashboardUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 640px;">
      <h2 style="font-family: Georgia, serif; color: #6b3822; margin-bottom: 4px;">Executed contract</h2>
      <p style="color: #666; margin-top: 0; font-size: 13px;">Ready for invoicing — ${escape(p.eventName)} ${p.eventYear}</p>

      <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #666; width: 180px;">Exhibitor</td>
            <td style="padding: 6px 0; font-weight: 600;">${escape(p.exhibitorCompanyName)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Legal name</td>
            <td style="padding: 6px 0;">${escape(p.exhibitorLegalName)}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Event</td>
            <td style="padding: 6px 0;">${escape(p.eventName)} — ${escape(p.eventDate)}</td></tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;
                    border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5;">
        <tr><td style="padding: 8px 0; color: #666;">Booths</td>
            <td style="padding: 8px 0; text-align: right;">${p.boothCount} × ${formatCents(p.boothRateCents)}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Additional brands</td>
            <td style="padding: 8px 0; text-align: right;">${p.additionalBrandCount} × $300</td></tr>
        <tr><td style="padding: 12px 0 8px; font-weight: 700; border-top: 1px solid #e5e5e5;">GRAND TOTAL</td>
            <td style="padding: 12px 0 8px; text-align: right; font-weight: 700; font-size: 18px; border-top: 1px solid #e5e5e5; color: #6b3822;">${formatCents(p.grandTotalCents)}</td></tr>
      </table>

      <p style="margin: 4px 0; font-size: 14px; color: #666;">Payment terms: Due upon receipt (Net 30 for discount)</p>

      <h3 style="margin-top: 32px; font-family: Georgia, serif; color: #6b3822;">Billing contact</h3>
      <p style="margin: 4px 0; font-size: 14px;">
        ${escape(p.signerName ?? '—')}${p.signerTitle ? ', ' + escape(p.signerTitle) : ''}<br>
        ${p.signerEmail ? `<a href="mailto:${escape(p.signerEmail)}">${escape(p.signerEmail)}</a>` : '—'}<br>
        ${escape(p.exhibitorTelephone ?? '—')}<br>
        ${escape(p.exhibitorAddress ?? '—')}
      </p>

      <p style="margin-top: 32px; font-size: 13px; color: #666;">
        <a href="${escape(p.signedPdfUrl)}">View signed PDF in Drive</a> ·
        <a href="${escape(p.dashboardUrl)}">Contract record</a>
      </p>
    </div>
  `;

  const recipients = toAddress.split(',').map((s) => s.trim());
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
        filename: `${p.exhibitorCompanyName} — WhiskyFest ${p.eventYear} Contract (SIGNED).pdf`,
        content: p.signedPdfBytes.toString('base64'),
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  });
}
