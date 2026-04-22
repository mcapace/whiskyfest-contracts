import sgMail from '@sendgrid/mail';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Contract } from '@/types/db';

function formatCents(n: number): string {
  return `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function appContractUrl(contractId: string): string {
  const explicit = process.env['NEXTAUTH_URL']?.replace(/\/$/, '');
  if (explicit) return `${explicit}/contracts/${contractId}`;
  if (process.env['VERCEL_URL']) return `https://${process.env['VERCEL_URL']}/contracts/${contractId}`;
  return `http://localhost:3000/contracts/${contractId}`;
}

/**
 * Email all active admins when a discounted contract is created (booth rate &lt; standard).
 */
export async function notifyAdminsOfDiscountRequest(
  contract: Pick<Contract, 'id' | 'exhibitor_company_name' | 'booth_rate_cents' | 'booth_count'> & {
    grand_total_cents?: number;
  },
  creator: { email: string; name?: string | null },
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  const fromEmail = process.env['DISCOUNT_ALERT_FROM_EMAIL'] ?? 'wfcontracts@whiskyadvocate.com';
  const fromName = 'WhiskyFest Contracts';

  if (!apiKey) {
    console.warn('[notifyAdminsOfDiscountRequest] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: admins } = await supabase
    .from('app_users')
    .select('email')
    .eq('role', 'admin')
    .eq('is_active', true);

  const recipients = (admins ?? [])
    .map((a) => (a as { email: string }).email?.trim().toLowerCase())
    .filter(Boolean) as string[];

  if (recipients.length === 0) {
    console.warn('[notifyAdminsOfDiscountRequest] No active admin emails — skipping');
    return;
  }

  const formattedRate = formatCents(contract.booth_rate_cents);
  const boothTotal = contract.booth_count * contract.booth_rate_cents;
  const grand =
    typeof contract.grand_total_cents === 'number' ? contract.grand_total_cents : boothTotal;

  sgMail.setApiKey(apiKey);

  const subject = `Discount approval needed: ${contract.exhibitor_company_name} at ${formattedRate}`;
  const detailUrl = appContractUrl(contract.id);

  const creatorLine = creator.name ? `${creator.name} <${creator.email}>` : creator.email;

  const text = [
    `A contract was created with a discounted booth rate (below the $15,000 standard).`,
    ``,
    `Exhibitor: ${contract.exhibitor_company_name}`,
    `Booth rate: ${formattedRate}`,
    `Grand total: ${formatCents(grand)}`,
    `Created by: ${creatorLine}`,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Discount approval needed</strong></p>
      <p>Booth rate <strong>${formattedRate}</strong> is below the standard rate.</p>
      <table style="margin-top:16px;font-size:14px;">
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Exhibitor</td><td>${escapeHtml(contract.exhibitor_company_name)}</td></tr>
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Grand total</td><td>${escapeHtml(formatCents(grand))}</td></tr>
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Created by</td><td>${escapeHtml(creatorLine)}</td></tr>
      </table>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in WhiskyFest Contracts</a></p>
    </div>
  `;

  await sgMail.send({
    from: { email: fromEmail, name: fromName },
    to: recipients,
    subject,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
