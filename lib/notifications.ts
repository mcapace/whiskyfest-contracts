import sgMail from '@sendgrid/mail';
import { contractPricingHtmlFragment, contractPricingTextLines } from '@/lib/contract-email-pricing';
import {
  appBaseUrl,
  appContractUrl,
  eventEmailContextForContract,
  loadEventEmailContext,
  sendGridFromForEvent,
  sendGridFromForProduct,
  workspaceLabelForEvent,
  type EventEmailContext,
} from '@/lib/product-email';
import { isNyweEventsManagedEvent } from '@/lib/contract-template-profile';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  mergeAssistantCc,
  resolveNotificationRecipients,
  type ContractNotificationContext,
  type NotificationKind,
} from '@/lib/notification-routing';
import { formatCurrency } from '@/lib/utils';
import type { Contract, Event } from '@/types/db';

const WHISKYFEST_MAIL_FROM = sendGridFromForProduct('whiskyfest');
/** Portal-wide emails (access requests, announcements) always use WhiskyFest sender. */
const WF_CONTRACTS_FROM_EMAIL = WHISKYFEST_MAIL_FROM.email;
const WF_CONTRACTS_FROM_NAME = WHISKYFEST_MAIL_FROM.name;

async function contractMailMeta(
  contract: { id: string; event_id?: string | null },
  event?: EventEmailContext | null,
) {
  const eventCtx = await eventEmailContextForContract(contract, event ?? null);
  return {
    eventCtx,
    from: sendGridFromForEvent(eventCtx),
    workspaceLabel: workspaceLabelForEvent(eventCtx),
    detailUrl: appContractUrl(contract.id, eventCtx),
  };
}

function formatCents(n: number): string {
  return `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function contractNotifyContext(
  contract: { id?: string; event_id?: string | null; sales_rep_id?: string | null; created_by?: string | null },
  event?: Partial<Pick<Event, 'workflow_profile' | 'product_key' | 'shanken_signatory_email'>> | null,
  createdBy?: string | null,
): ContractNotificationContext {
  return {
    contractId: contract.id,
    eventId: contract.event_id,
    salesRepId: contract.sales_rep_id ?? null,
    createdBy: createdBy ?? contract.created_by ?? null,
    event: event ?? null,
  };
}

async function sendRoutedContractEmail(params: {
  kind: NotificationKind;
  ctx: ContractNotificationContext;
  logLabel: string;
  from: { email: string; name: string };
  subject: string;
  text: string;
  html: string;
  /** WhiskyFest only — CC rep assistants on rep-owned mail. */
  assistantRepId?: string | null;
}): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn(`[${params.logLabel}] SENDGRID_API_KEY not set — skipping email`);
    return;
  }

  let routed = await resolveNotificationRecipients(params.kind, params.ctx);
  if (routed.skip) {
    console.info(`[${params.logLabel}] skipped — ${routed.skipReason ?? 'no recipients'}`);
    return;
  }

  if (params.assistantRepId) {
    const assistants = await getAssistantEmailsForRep(params.assistantRepId);
    routed = mergeAssistantCc(routed, assistants);
  }

  if (routed.to.length === 0) {
    console.warn(`[${params.logLabel}] No recipients — skipping`);
    return;
  }

  sgMail.setApiKey(apiKey);
  await sgMail.send({
    from: params.from,
    to: routed.to,
    ...(routed.cc.length > 0 ? { cc: routed.cc } : {}),
    ...(routed.bcc.length > 0 ? { bcc: routed.bcc } : {}),
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}

/** Active app_users assistant emails mapped to support this rep's contracts. */
export async function getAssistantEmailsForRep(repId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase.from('rep_assistants').select('assistant_email').eq('rep_id', repId);

  const assistantEmails = [...new Set((rows ?? []).map((r) => String((r as { assistant_email: string }).assistant_email).toLowerCase()))];
  if (assistantEmails.length === 0) return [];

  const { data: activeUsers } = await supabase
    .from('app_users')
    .select('email')
    .eq('is_active', true)
    .in('email', assistantEmails);

  return [...new Set((activeUsers ?? []).map((u) => String((u as { email: string }).email).toLowerCase()))];
}

/**
 * Email all active admins when a discounted contract is created (booth rate &lt; standard).
 */
export async function notifyAdminsOfDiscountRequest(
  contract: Pick<Contract, 'id' | 'event_id' | 'exhibitor_company_name' | 'booth_rate_cents' | 'booth_count'> & {
    grand_total_cents?: number;
    booth_subtotal_cents?: number;
    line_items_subtotal_cents?: number | null;
  },
  creator: { email: string; name?: string | null },
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  const mail = await contractMailMeta(contract);

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

  const excluded = new Set(
    (process.env['NOTIFICATION_EXCLUDED_EMAILS'] ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

  const recipients = (admins ?? [])
    .map((a) => (a as { email: string }).email?.trim().toLowerCase())
    .filter((email): email is string => Boolean(email) && !excluded.has(email));

  if (recipients.length === 0) {
    console.warn('[notifyAdminsOfDiscountRequest] No active admin emails — skipping');
    return;
  }

  const formattedRate = formatCents(contract.booth_rate_cents);
  const boothTotal = contract.booth_count * contract.booth_rate_cents;
  const grand =
    typeof contract.grand_total_cents === 'number' ? contract.grand_total_cents : boothTotal;
  const boothSub =
    typeof contract.booth_subtotal_cents === 'number' ? contract.booth_subtotal_cents : boothTotal;
  const pricingLines = contractPricingTextLines({
    booth_subtotal_cents: boothSub,
    line_items_subtotal_cents: contract.line_items_subtotal_cents,
    grand_total_cents: grand,
  });

  sgMail.setApiKey(apiKey);

  const subject = `Discount approval needed: ${contract.exhibitor_company_name} at ${formattedRate}`;
  const detailUrl = mail.detailUrl;

  const creatorLine = creator.name ? `${creator.name} <${creator.email}>` : creator.email;

  const text = [
    `A contract was created with a discounted booth rate (below the $15,000 standard).`,
    ``,
    `Exhibitor: ${contract.exhibitor_company_name}`,
    `Booth rate: ${formattedRate}`,
    ...pricingLines,
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
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Created by</td><td>${escapeHtml(creatorLine)}</td></tr>
      </table>
      ${contractPricingHtmlFragment({
        booth_subtotal_cents: boothSub,
        line_items_subtotal_cents: contract.line_items_subtotal_cents,
        grand_total_cents: grand,
      })}
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sgMail.send({
    from: mail.from,
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
  contract: Pick<Contract, 'id' | 'event_id' | 'exhibitor_company_name' | 'booth_rate_cents' | 'sales_rep_id'>,
  approver: { email: string; name?: string | null },
  approvalReason: string | null,
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifySalesRepDiscountApproved] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  if (!contract.sales_rep_id) {
    const routed = await resolveNotificationRecipients('discount_approved', contractNotifyContext(contract));
    if (routed.skip || routed.to.length === 0) return;
  }

  const mail = await contractMailMeta(contract);
  const detailUrl = mail.detailUrl;
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
    `You can continue from the contract page: generate or refresh the PDF, submit for Events Review if needed, and after status is Approved, send via DocuSign.`,
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
      <p>You can continue from the contract page: generate or refresh the PDF, submit for <strong>Events Review</strong> if needed, and after the status is <strong>Approved</strong>, use <strong>Send via DocuSign</strong>.</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'discount_approved',
    ctx: contractNotifyContext(contract),
    logLabel: 'notifySalesRepDiscountApproved',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: contract.sales_rep_id,
  });
}

/**
 * Email events team + sales rep + assistants when the exhibitor signs (envelope moves to partially signed).
 */
export async function notifyPartialSignature(
  contract: Pick<
    Contract,
    'id' | 'event_id' | 'exhibitor_company_name' | 'signer_1_name' | 'sales_rep_id' | 'booth_count' | 'booth_rate_cents'
  > & {
    sales_rep_email?: string | null;
    booth_subtotal_cents?: number;
    line_items_subtotal_cents?: number | null;
    grand_total_cents?: number;
  },
  event: Pick<Event, 'name' | 'year' | 'shanken_signatory_name' | 'shanken_signatory_email' | 'product_key' | 'workflow_profile'> | null,
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifyPartialSignature] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const nywe = event ? isNyweEventsManagedEvent(event) : false;
  const mail = await contractMailMeta(contract, event);

  const eventTitle = event ? `${event.name} ${event.year}`.trim() : 'WhiskyFest';
  const detailUrl = mail.detailUrl;
  const exhibitorPerson = (contract.signer_1_name ?? '').trim() || (nywe ? 'Winery contact' : 'Exhibitor');
  const company = contract.exhibitor_company_name.trim();
  const signatoryName = (event?.shanken_signatory_name ?? '').trim() || 'the Shanken signatory';

  const subject = nywe
    ? `${company} signed — countersign in DocuSign`
    : `${exhibitorPerson} from ${company} signed — awaiting countersignature`;

  const para1 = nywe
    ? `${company} has signed the ${eventTitle} contract.`
    : `${exhibitorPerson} at ${company} has signed the ${eventTitle} contract.`;
  const para2 = nywe
    ? `Open the DocuSign email in your inbox to countersign as ${signatoryName}. Accounting is notified automatically after you sign.`
    : `The contract is now awaiting countersignature from ${signatoryName}. They will receive a separate DocuSign email shortly.`;
  const boothSub = contract.booth_subtotal_cents ?? contract.booth_count * contract.booth_rate_cents;
  const grand =
    typeof contract.grand_total_cents === 'number'
      ? contract.grand_total_cents
      : boothSub + (contract.line_items_subtotal_cents ?? 0);
  const pricingText = contractPricingTextLines({
    booth_subtotal_cents: boothSub,
    line_items_subtotal_cents: contract.line_items_subtotal_cents,
    grand_total_cents: grand,
  }).join('\n');

  const text = [para1, ``, para2, ``, pricingText, ``, `Open contract: ${detailUrl}`].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p>${escapeHtml(para1)}</p>
      <p>${escapeHtml(para2)}</p>
      ${contractPricingHtmlFragment({
        booth_subtotal_cents: boothSub,
        line_items_subtotal_cents: contract.line_items_subtotal_cents,
        grand_total_cents: grand,
      })}
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'partial_signature',
    ctx: contractNotifyContext(contract, event),
    logLabel: 'notifyPartialSignature',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: nywe ? null : contract.sales_rep_id,
  });
}

/**
 * Email events team + sales rep + assistants when the envelope is fully signed (ready for release).
 */
export async function notifyContractFullySigned(
  contract: Pick<
    Contract,
    'id' | 'event_id' | 'exhibitor_company_name' | 'signer_1_name' | 'sales_rep_id' | 'booth_count' | 'booth_rate_cents'
  > & {
    sales_rep_email?: string | null;
    booth_subtotal_cents?: number;
    line_items_subtotal_cents?: number | null;
    grand_total_cents?: number;
  },
  event: Pick<Event, 'name' | 'year' | 'product_key'> | null,
  countersignerDisplayName: string,
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifyContractFullySigned] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const mail = await contractMailMeta(contract, event);

  const eventTitle = event ? `${event.name} ${event.year}`.trim() : 'WhiskyFest';
  const company = contract.exhibitor_company_name.trim();
  const exhibitorPerson = (contract.signer_1_name ?? '').trim() || 'Exhibitor';
  const countersignerLine = countersignerDisplayName.trim() || 'Countersigner';

  const subject = `${company} — fully signed and ready for release`;
  const detailUrl = mail.detailUrl;

  const boothSub = contract.booth_subtotal_cents ?? contract.booth_count * contract.booth_rate_cents;
  const grand =
    typeof contract.grand_total_cents === 'number'
      ? contract.grand_total_cents
      : boothSub + (contract.line_items_subtotal_cents ?? 0);
  const pricingText = contractPricingTextLines({
    booth_subtotal_cents: boothSub,
    line_items_subtotal_cents: contract.line_items_subtotal_cents,
    grand_total_cents: grand,
  }).join('\n');

  const text = [
    `The ${eventTitle} contract for ${company} has been fully signed.`,
    ``,
    `Exhibitor: ${exhibitorPerson} at ${company}`,
    `Countersigner: ${countersignerLine} (M. Shanken)`,
    ``,
    pricingText,
    ``,
    `Contract is now ready to be released to accounting. Open the contract in ${mail.workspaceLabel} to release.`,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p>The ${escapeHtml(eventTitle)} contract for <strong>${escapeHtml(company)}</strong> has been fully signed.</p>
      <p style="margin-top:14px;">
        <strong>Exhibitor:</strong> ${escapeHtml(exhibitorPerson)} at ${escapeHtml(company)}<br/>
        <strong>Countersigner:</strong> ${escapeHtml(countersignerLine)} (M. Shanken)
      </p>
      ${contractPricingHtmlFragment({
        booth_subtotal_cents: boothSub,
        line_items_subtotal_cents: contract.line_items_subtotal_cents,
        grand_total_cents: grand,
      })}
      <p style="margin-top:14px;">Contract is now ready to be released to accounting. Open the contract in ${escapeHtml(mail.workspaceLabel)} to release.</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'fully_signed',
    ctx: contractNotifyContext(contract, event),
    logLabel: 'notifyContractFullySigned',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: contract.sales_rep_id,
  });
}

/** Alert events team that a contract PDF is ready for review. */
export async function notifyEventsTeamOfPendingReview(
  contract: Pick<Contract, 'id' | 'event_id' | 'exhibitor_company_name' | 'booth_rate_cents' | 'booth_count'> & {
    grand_total_cents?: number;
    booth_subtotal_cents?: number;
    line_items_subtotal_cents?: number | null;
    sales_rep_name?: string | null;
    sales_rep_email?: string | null;
  },
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifyEventsTeamOfPendingReview] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  sgMail.setApiKey(apiKey);
  const mail = await contractMailMeta(contract);

  const boothSubFallback = contract.booth_count * contract.booth_rate_cents;
  const grand =
    typeof contract.grand_total_cents === 'number'
      ? contract.grand_total_cents
      : boothSubFallback;
  const boothSub =
    typeof contract.booth_subtotal_cents === 'number' ? contract.booth_subtotal_cents : boothSubFallback;

  const totalLabel = formatCents(grand);
  const rateLabel = formatCents(contract.booth_rate_cents);
  const repLabel = contract.sales_rep_name ?? contract.sales_rep_email ?? '—';
  const detailUrl = mail.detailUrl;
  const subject = `Review needed: ${contract.exhibitor_company_name} — ${totalLabel}`;
  const pricingLines = contractPricingTextLines({
    booth_subtotal_cents: boothSub,
    line_items_subtotal_cents: contract.line_items_subtotal_cents,
    grand_total_cents: grand,
  });

  const text = [
    `A contract PDF has been submitted for events team review.`,
    ``,
    `Exhibitor: ${contract.exhibitor_company_name}`,
    `Booth rate: ${rateLabel}`,
    ...pricingLines,
    `Sales rep: ${repLabel}`,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Review needed</strong></p>
      <table style="margin-top:12px;font-size:14px;">
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Exhibitor</td><td>${escapeHtml(contract.exhibitor_company_name)}</td></tr>
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Booth rate</td><td>${escapeHtml(rateLabel)}</td></tr>
        <tr><td style="color:#666;padding:4px 12px 4px 0;">Sales rep</td><td>${escapeHtml(repLabel)}</td></tr>
      </table>
      ${contractPricingHtmlFragment({
        booth_subtotal_cents: boothSub,
        line_items_subtotal_cents: contract.line_items_subtotal_cents,
        grand_total_cents: grand,
      })}
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'pending_review',
    ctx: contractNotifyContext(contract),
    logLabel: 'notifyEventsTeamOfPendingReview',
    from: mail.from,
    subject,
    text,
    html,
  });
}

export async function notifySalesRepEventsApproved(
  contract: Pick<Contract, 'id' | 'event_id' | 'exhibitor_company_name' | 'sales_rep_id'>,
  approver: { email: string; name?: string | null },
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifySalesRepEventsApproved] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  sgMail.setApiKey(apiKey);
  const mail = await contractMailMeta(contract);

  const detailUrl = mail.detailUrl;
  const subject = `Contract approved: ${contract.exhibitor_company_name} — ready to send`;
  const approverLine = approver.name ? `${approver.name} <${approver.email}>` : approver.email;

  const text = [
    `The events team approved ${contract.exhibitor_company_name} for DocuSign.`,
    ``,
    `Approved by: ${approverLine}`,
    ``,
    `You can send this contract via DocuSign when ready.`,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Ready to send</strong></p>
      <p>${escapeHtml(contract.exhibitor_company_name)} was approved by the events team (${escapeHtml(approverLine)}).</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'events_approved',
    ctx: contractNotifyContext(contract),
    logLabel: 'notifySalesRepEventsApproved',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: contract.sales_rep_id,
  });
}

export async function notifySalesRepContractRecalled(params: {
  contract: Pick<Contract, 'id' | 'event_id' | 'exhibitor_company_name' | 'sales_rep_id'>;
  event: Pick<Event, 'name' | 'year' | 'product_key'> | null;
  recalledBy: { email: string; name?: string | null };
  reason: string;
}): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifySalesRepContractRecalled] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  sgMail.setApiKey(apiKey);
  const mail = await contractMailMeta(params.contract, params.event);

  const detailUrl = mail.detailUrl;
  const eventTitle = params.event ? `${params.event.name} ${params.event.year}`.trim() : 'WhiskyFest';
  const actorLine = params.recalledBy.name
    ? `${params.recalledBy.name} <${params.recalledBy.email}>`
    : params.recalledBy.email;

  const subject = `Contract recalled for edits: ${params.contract.exhibitor_company_name}`;
  const text = [
    `The ${eventTitle} contract for ${params.contract.exhibitor_company_name} was recalled from DocuSign and returned to draft.`,
    ``,
    `Recalled by: ${actorLine}`,
    ``,
    params.reason,
    ``,
    `Edit and re-send: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Contract recalled</strong></p>
      <p>The in-flight DocuSign envelope was voided and the contract is back in <strong>draft</strong> for revisions.</p>
      <p>${escapeHtml(actorLine)} noted:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;">${escapeHtml(params.reason)}</blockquote>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'contract_recalled',
    ctx: contractNotifyContext(params.contract, params.event),
    logLabel: 'notifySalesRepContractRecalled',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: params.contract.sales_rep_id,
  });
}

export async function notifySalesRepContractSentBack(
  contract: Pick<Contract, 'id' | 'event_id' | 'exhibitor_company_name' | 'sales_rep_id'>,
  sender: { email: string; name?: string | null },
  reason: string,
): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifySalesRepContractSentBack] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  sgMail.setApiKey(apiKey);
  const mail = await contractMailMeta(contract);

  const detailUrl = mail.detailUrl;
  const subject = `Contract needs changes: ${contract.exhibitor_company_name}`;
  const senderLine = sender.name ? `${sender.name} <${sender.email}>` : sender.email;

  const text = [
    `The events team sent back ${contract.exhibitor_company_name} for changes.`,
    ``,
    `From: ${senderLine}`,
    ``,
    reason,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Changes requested</strong></p>
      <p>${escapeHtml(senderLine)} requested updates:</p>
      <blockquote style="border-left:3px solid #ccc;padding-left:12px;margin:12px 0;">${escapeHtml(reason)}</blockquote>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'contract_sent_back',
    ctx: contractNotifyContext(contract),
    logLabel: 'notifySalesRepContractSentBack',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: contract.sales_rep_id,
  });
}

/**
 * Notify sales rep + events team that a contract was voided while in DocuSign.
 * DocuSign itself notifies exhibitor recipients about the envelope void.
 */
export async function notifyContractVoided(params: {
  contract: Pick<Contract, 'id' | 'event_id' | 'exhibitor_company_name' | 'sales_rep_id'> & {
    sales_rep_name?: string | null;
    sales_rep_email?: string | null;
  };
  event: Pick<Event, 'name' | 'year' | 'product_key'> | null;
  voidedBy: { email: string; name?: string | null };
  reason: string;
  voidedAtIso: string;
}): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifyContractVoided] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const mail = await contractMailMeta(params.contract, params.event);
  const detailUrl = mail.detailUrl;
  const eventTitle = params.event ? `${params.event.name} ${params.event.year}`.trim() : 'WhiskyFest';
  const company = params.contract.exhibitor_company_name;
  const voider = params.voidedBy.name ? `${params.voidedBy.name} <${params.voidedBy.email}>` : params.voidedBy.email;
  const atLabel = new Date(params.voidedAtIso).toLocaleString('en-US');

  sgMail.setApiKey(apiKey);

  const subject = `${company} contract voided`;
  const text = [
    `The ${eventTitle} contract for ${company} has been voided before countersignature.`,
    '',
    `Voided by: ${voider}`,
    `Reason: ${params.reason}`,
    `Voided at: ${atLabel}`,
    '',
    `If you need to resend this contract with corrections, you'll need to create a new contract.`,
    '',
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p>The contract for <strong>${escapeHtml(company)}</strong> has been voided before countersignature.</p>
      <p style="margin-top:14px;">
        <strong>Voided by:</strong> ${escapeHtml(voider)}<br/>
        <strong>Reason:</strong> ${escapeHtml(params.reason)}<br/>
        <strong>Voided at:</strong> ${escapeHtml(atLabel)}
      </p>
      <p style="margin-top:14px;">If you need to resend this contract with corrections, you'll need to create a new contract.</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  const ctx = contractNotifyContext(params.contract, params.event);

  await sendRoutedContractEmail({
    kind: 'contract_voided',
    ctx,
    logLabel: 'notifyContractVoided',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: params.contract.sales_rep_id,
  });

  await sendRoutedContractEmail({
    kind: 'contract_voided_visibility',
    ctx,
    logLabel: 'notifyContractVoided.visibility',
    from: mail.from,
    subject: `${company} contract voided — visibility`,
    text,
    html,
  });
}

/** Sales rep / ops notification when AR marks invoice sent. */
export async function notifySalesRepInvoiceSent(params: {
  contractId: string;
  companyName: string;
  grandTotalCents: number;
  sentAtLabel: string;
  salesRepId: string | null;
  eventId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifySalesRepInvoiceSent] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: contractRow } = await supabase
    .from('contracts')
    .select('event_id, created_by')
    .eq('id', params.contractId)
    .maybeSingle();
  const eventId = params.eventId ?? (contractRow as { event_id?: string } | null)?.event_id;
  const createdBy = params.createdBy ?? (contractRow as { created_by?: string } | null)?.created_by ?? null;

  const eventCtx = await loadEventEmailContext(eventId);
  const mail = {
    from: sendGridFromForEvent(eventCtx),
    workspaceLabel: workspaceLabelForEvent(eventCtx),
    detailUrl: appContractUrl(params.contractId, eventCtx),
  };
  const detailUrl = mail.detailUrl;
  const subject = `Invoice sent for ${params.companyName}`;
  const amt = formatCurrency(params.grandTotalCents);

  const text = [
    `An invoice has been sent for ${params.companyName}.`,
    ``,
    `Amount: ${amt}`,
    `Invoice sent: ${params.sentAtLabel}`,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Invoice sent</strong> for ${escapeHtml(params.companyName)}</p>
      <p>Amount: <strong>${escapeHtml(amt)}</strong><br/>Marked: ${escapeHtml(params.sentAtLabel)}</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'invoice_sent',
    ctx: {
      contractId: params.contractId,
      eventId,
      salesRepId: params.salesRepId,
      createdBy,
    },
    logLabel: 'notifySalesRepInvoiceSent',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: params.salesRepId,
  });
}

/** Sales rep / events-team notification when AR marks invoice paid. */
export async function notifySalesRepInvoicePaid(params: {
  contractId: string;
  companyName: string;
  salesRepId: string | null;
  eventId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifySalesRepInvoicePaid] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: contractRow } = await supabase
    .from('contracts')
    .select('event_id, created_by')
    .eq('id', params.contractId)
    .maybeSingle();
  const eventId = params.eventId ?? (contractRow as { event_id?: string } | null)?.event_id;
  const createdBy = params.createdBy ?? (contractRow as { created_by?: string } | null)?.created_by ?? null;

  const eventCtx = await loadEventEmailContext(eventId);
  const mail = {
    from: sendGridFromForEvent(eventCtx),
    workspaceLabel: workspaceLabelForEvent(eventCtx),
    detailUrl: appContractUrl(params.contractId, eventCtx),
  };
  const detailUrl = mail.detailUrl;
  const subject = `${params.companyName} — Paid`;

  const text = [
    `Great news — ${params.companyName}'s invoice has been paid. Contract closed out.`,
    ``,
    `Open contract: ${detailUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p>Great news — <strong>${escapeHtml(params.companyName)}</strong>'s invoice has been paid. Contract closed out.</p>
      <p style="margin-top:20px;"><a href="${detailUrl}">Open contract in ${escapeHtml(mail.workspaceLabel)}</a></p>
    </div>
  `;

  await sendRoutedContractEmail({
    kind: 'invoice_paid',
    ctx: {
      contractId: params.contractId,
      eventId,
      salesRepId: params.salesRepId,
      createdBy,
    },
    logLabel: 'notifySalesRepInvoicePaid',
    from: mail.from,
    subject,
    text,
    html,
    assistantRepId: params.salesRepId,
  });
}

export async function notifyAdminsOfAccessRequest(params: {
  id: string;
  email: string;
  name: string | null;
  requestedAtIso: string;
  approvalToken: string;
}): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifyAdminsOfAccessRequest] SENDGRID_API_KEY not set — skipping email');
    return;
  }
  sgMail.setApiKey(apiKey);
  const requestedAt = new Date(params.requestedAtIso).toLocaleString('en-US');
  const subject = `Access request: ${params.name?.trim() || 'Unknown'} (${params.email})`;
  const base = appBaseUrl();
  const approveUrl = `${base}/admin/access-requests/${params.id}?token=${params.approvalToken}&action=approve`;
  const denyUrl = `${base}/admin/access-requests/${params.id}?token=${params.approvalToken}&action=deny`;

  const text = [
    'Someone is requesting access to WhiskyFest Contracts.',
    '',
    `Name: ${params.name ?? 'Unknown'}`,
    `Email: ${params.email}`,
    `Requested at: ${requestedAt}`,
    '',
    `Approve: ${approveUrl}`,
    `Deny: ${denyUrl}`,
    '',
    'Tokens expire in 24 hours and can only be used once.',
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 640px;">
      <p>Someone is requesting access to WhiskyFest Contracts.</p>
      <p>
        <strong>Name:</strong> ${escapeHtml(params.name ?? 'Unknown')}<br/>
        <strong>Email:</strong> ${escapeHtml(params.email)}<br/>
        <strong>Requested at:</strong> ${escapeHtml(requestedAt)}
      </p>
      <p>
        <a href="${approveUrl}" style="display:inline-block;margin-right:8px;padding:8px 12px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">Approve</a>
        <a href="${denyUrl}" style="display:inline-block;padding:8px 12px;background:#991b1b;color:#fff;text-decoration:none;border-radius:6px;">Deny</a>
      </p>
      <p>Tokens expire in 24 hours and can only be used once.</p>
    </div>
  `;

  await sgMail.send({
    from: { email: WF_CONTRACTS_FROM_EMAIL, name: WF_CONTRACTS_FROM_NAME },
    to: ['mcapace@mshanken.com', 'jarcella@mshanken.com'],
    subject,
    text,
    html,
  });
}

export async function notifyAccessRequestApproved(email: string): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) return;
  sgMail.setApiKey(apiKey);
  const base = appBaseUrl();
  await sgMail.send({
    from: { email: WF_CONTRACTS_FROM_EMAIL, name: WF_CONTRACTS_FROM_NAME },
    to: email,
    subject: "You're approved — welcome to WhiskyFest Contracts",
    text: `Great news — your access to WhiskyFest Contracts has been approved. Sign in at ${base} with your @mshanken.com Google account.`,
    html: `<p>Great news — your access to WhiskyFest Contracts has been approved.</p><p>Sign in at <a href="${base}">${base}</a> with your @mshanken.com Google account.</p>`,
  });
}

export async function notifyAccessRequestRejected(email: string, reason?: string | null): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) return;
  sgMail.setApiKey(apiKey);
  const reasonBlock = reason?.trim() ? `<p><strong>Reason:</strong> ${escapeHtml(reason.trim())}</p>` : '';
  await sgMail.send({
    from: { email: WF_CONTRACTS_FROM_EMAIL, name: WF_CONTRACTS_FROM_NAME },
    to: email,
    subject: 'Access request declined',
    text: `Your access request to WhiskyFest Contracts was not approved.${reason?.trim() ? `\nReason: ${reason.trim()}` : ''}\nIf you believe this was in error, contact Mike Capace at mcapace@mshanken.com.`,
    html: `<p>Your access request to WhiskyFest Contracts was not approved.</p>${reasonBlock}<p>If you believe this was in error, contact Mike Capace at <a href="mailto:mcapace@mshanken.com">mcapace@mshanken.com</a>.</p>`,
  });
}

/** Liz + Nicole — optional one-shot email via POST /api/admin/countersigner-announcement after migration. */
export async function notifyCountersignerRoleAnnouncement(): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    console.warn('[notifyCountersignerRoleAnnouncement] SENDGRID_API_KEY not set — skipping email');
    return;
  }

  const liz = 'lmott@mshanken.com';
  const nicole = 'nmazza@mshanken.com';

  sgMail.setApiKey(apiKey);

  const subject = 'WhiskyFest contracts: Nicole Mazza is now the M. Shanken countersignatory';
  const text = [
    'Nicole Mazza is now the default M. Shanken countersignatory on WhiskyFest event records.',
    '',
    'New DocuSign envelopes will route the Shanken countersignature step to nmazza@mshanken.com.',
    'Contracts already sent (in-flight or completed) keep their original routing.',
    '',
    '— WhiskyFest Contracts',
  ].join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px;">
      <p><strong>Nicole Mazza</strong> is now the default M. Shanken countersignatory for WhiskyFest contracts.</p>
      <p>New DocuSign envelopes will route the Shanken countersignature step to <a href="mailto:${escapeHtml(nicole)}">${escapeHtml(nicole)}</a>.</p>
      <p style="color:#555;font-size:14px;">Contracts already sent keep their original countersigner routing.</p>
    </div>
  `;

  await sgMail.send({
    from: { email: WF_CONTRACTS_FROM_EMAIL, name: WF_CONTRACTS_FROM_NAME },
    to: [nicole, liz],
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
