import sgMail from '@sendgrid/mail';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { Contract, Event } from '@/types/db';

const WF_CONTRACTS_FROM_EMAIL = process.env['DISCOUNT_ALERT_FROM_EMAIL'] ?? 'wfcontracts@whiskyadvocate.com';
const WF_CONTRACTS_FROM_NAME = 'WhiskyFest Contracts';

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
  const fromEmail = WF_CONTRACTS_FROM_EMAIL;
  const fromName = WF_CONTRACTS_FROM_NAME;

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

/**
 * Email the assigned sales rep when an admin approves their discounted booth rate.
 */
export async function notifySalesRepDiscountApproved(
  contract: Pick<Contract, 'id' | 'exhibitor_company_name' | 'booth_rate_cents' | 'sales_rep_id'>,
  approver: { email: string; name?: string | null },
  approvalReason: string | null,
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifySalesRepDiscountApproved] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  if (!contract.sales_rep_id) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: rep } = await supabase.from('sales_reps').select('email').eq('id', contract.sales_rep_id).maybeSingle();

  const toAddress = rep?.email?.trim();
  if (!toAddress) {
    console.warn('[notifySalesRepDiscountApproved] No sales rep email — skipping');
    return;
  }

  sgMail.setApiKey(apiKey);

  const detailUrl = appContractUrl(contract.id);
  const rateLine = formatCents(contract.booth_rate_cents);
  const approverLine = approver.name ? `${approver.name} <${approver.email}>` : approver.email;
  const reasonBlock =
    approvalReason && approvalReason.length > 0
      ? [`Approval notes: ${approvalReason}`, ``]
      : [];

  const subject = `Discount approved: ${contract.exhibitor_company_name}`;
  const text = [
    `Your discounted booth rate for ${contract.exhibitor_company_name} has been approved.`,
    ``,
    `Approved booth rate: ${rateLine}`,
    `Approved by: ${approverLine}`,
    ...reasonBlock,
    `You can now approve this contract for sending (Ready for Review → Approve for Sending).`,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const reasonHtml =
    approvalReason && approvalReason.length > 0
      ? `<p style="margin:16px 0;"><strong>Approval notes:</strong> ${escapeHtml(approvalReason)}</p>`
      : '';

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Discount approved</strong></p>
      <p>${escapeHtml(contract.exhibitor_company_name)} — approved booth rate <strong>${escapeHtml(rateLine)}</strong>.</p>
      <p style="color:#666;font-size:14px;">Approved by ${escapeHtml(approverLine)}</p>
      ${reasonHtml}
      <p>You can now <strong>approve this contract for sending</strong> when you are ready (Ready for Review → Approve for Sending).</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in WhiskyFest Contracts</a></p>
    </div>
  `;

  await sgMail.send({
    from: { email: WF_CONTRACTS_FROM_EMAIL, name: WF_CONTRACTS_FROM_NAME },
    to: toAddress,
    subject,
    text,
    html,
  });
}

/**
 * Email admins + assigned sales rep when the exhibitor signs (envelope moves to partially signed).
 */
export async function notifyPartialSignature(
  contract: Pick<Contract, 'id' | 'exhibitor_company_name' | 'sales_rep_id'> & {
    sales_rep_email?: string | null;
  },
  event: Pick<Event, 'name' | 'year'> | null,
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifyPartialSignature] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const supabase = getSupabaseAdmin();

  const { data: admins } = await supabase
    .from('app_users')
    .select('email')
    .eq('role', 'admin')
    .eq('is_active', true);

  const adminSet = new Set<string>(
    (admins ?? []).map((a) => String((a as { email: string }).email ?? '').trim().toLowerCase()).filter(Boolean),
  );

  let repEmail = contract.sales_rep_email?.trim().toLowerCase() ?? null;
  if (!repEmail && contract.sales_rep_id) {
    const { data: repRow } = await supabase.from('sales_reps').select('email').eq('id', contract.sales_rep_id).maybeSingle();
    repEmail = repRow?.email?.trim().toLowerCase() ?? null;
  }

  if (repEmail) adminSet.add(repEmail);

  const recipients = [...adminSet];
  if (recipients.length === 0) {
    console.warn('[notifyPartialSignature] No recipients — skipping');
    return;
  }

  sgMail.setApiKey(apiKey);

  const eventTitle = event ? `${event.name} ${event.year}`.trim() : 'WhiskyFest';
  const detailUrl = appContractUrl(contract.id);
  const subject = `Exhibitor signed: ${contract.exhibitor_company_name} — awaiting countersignature`;

  const bodySentence = `${contract.exhibitor_company_name} has signed the ${eventTitle} contract. It's now awaiting M. Shanken countersignature from Liz Mott.`;

  const text = [
    bodySentence,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p>${escapeHtml(bodySentence)}</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in WhiskyFest Contracts</a></p>
    </div>
  `;

  await sgMail.send({
    from: { email: WF_CONTRACTS_FROM_EMAIL, name: WF_CONTRACTS_FROM_NAME },
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
