import sgMail from '@sendgrid/mail';
import {
  appBaseUrlForProduct,
  sendGridFromForEvent,
  workspaceLabelForEvent,
  type EventEmailContext,
} from '@/lib/product-email';
import { productKeyFromEvent } from '@/lib/product-portal';
import { docuSignSigningRedirectUrl } from '@/lib/docusign-signing-link';

export type PersonalNudgeEmailParams = {
  contractId: string;
  event: EventEmailContext & { year?: number; name: string };
  exhibitorCompanyName: string;
  signerName: string | null;
  signerEmail: string;
  personalMessage: string;
  senderName: string;
  senderEmail: string;
  internalCcEmail?: string | null;
  internalCcName?: string | null;
  /** True when a fresh DocuSign signing email was also sent to the signer. */
  docusignResent?: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendPersonalContractNudgeEmail(p: PersonalNudgeEmailParams): Promise<void> {
  const apiKey = process.env['SENDGRID_API_KEY'];
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not set — cannot send personal nudge email');
  }

  sgMail.setApiKey(apiKey);

  const from = sendGridFromForEvent(p.event);
  const workspaceLabel = workspaceLabelForEvent(p.event);
  const signingUrl = docuSignSigningRedirectUrl(p.contractId, p.event, p.signerEmail);
  const eventLabel = p.event.year ? `${p.event.name} ${p.event.year}` : p.event.name;
  const subject = `Reminder: please sign your ${eventLabel} agreement`;

  const docusignNote = p.docusignResent
    ? 'We also sent a separate email from DocuSign with a direct signing link — you can use either email to sign.'
    : 'If the button below does not work, check your inbox for an email from DocuSign about signing this agreement.';

  const text = [
    p.personalMessage.trim(),
    '',
    docusignNote,
    '',
    `Review and sign: ${signingUrl}`,
    '',
    `— ${workspaceLabel}`,
  ].join('\n');

  const messageHtml = escapeHtml(p.personalMessage.trim()).replace(/\n/g, '<br/>');

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 620px; line-height: 1.55;">
      <p style="font-size:15px;">${messageHtml}</p>
      <p style="font-size:14px;color:#444;">${escapeHtml(docusignNote)}</p>
      <p style="margin:28px 0;">
        <a href="${escapeHtml(signingUrl)}"
           style="display:inline-block;padding:12px 20px;background:#6b3822;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Review and sign agreement
        </a>
      </p>
      <p style="color:#666;font-size:13px;">Or copy this link: <a href="${escapeHtml(signingUrl)}">${escapeHtml(signingUrl)}</a></p>
      <p style="color:#666;font-size:13px;margin-top:24px;">— ${escapeHtml(workspaceLabel)}</p>
    </div>
  `;

  const ccEmail = p.internalCcEmail?.trim().toLowerCase();
  const cc =
    ccEmail && ccEmail !== p.signerEmail.trim().toLowerCase()
      ? [{ email: ccEmail, name: p.internalCcName?.trim() || ccEmail }]
      : undefined;

  await sgMail.send({
    from: { email: from.email, name: p.senderName.trim() || from.name },
    replyTo: { email: p.senderEmail.trim(), name: p.senderName.trim() || p.senderEmail.trim() },
    to: [{ email: p.signerEmail.trim(), name: p.signerName?.trim() || p.signerEmail.trim() }],
    cc,
    subject,
    text,
    html,
  });
}

export function personalNudgeReturnUrl(event: EventEmailContext | null | undefined): string {
  return `${appBaseUrlForProduct(productKeyFromEvent(event))}/auth/login?signed=1`;
}
