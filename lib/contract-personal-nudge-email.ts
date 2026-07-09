import sgMail from '@sendgrid/mail';
import {
  appBaseUrlForProduct,
  sendGridFromForEvent,
  workspaceLabelForEvent,
  type EventEmailContext,
} from '@/lib/product-email';
import { productKeyFromEvent } from '@/lib/product-portal';
import { exhibitorSigningAccentHex } from '@/lib/exhibitor-signing-portal';

function eventLabelForEmail(event: { name: string; year?: number }): string {
  const name = event.name.trim();
  const year = event.year;
  if (!year) return name;
  if (new RegExp(`\\b${year}\\b`).test(name)) return name;
  return `${name} ${year}`;
}

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
  /** Pre-built exhibitor signing landing URL (/sign?c=...&t=...). */
  signingUrl: string;
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
  const signingUrl = p.signingUrl.trim();
  const eventLabel = eventLabelForEmail(p.event);
  const subject = `Reminder: please sign your ${eventLabel} agreement`;

  const docusignNote =
    'This link opens the same agreement we originally sent you — not a new contract. Click the button below, then press "Continue to sign" on the next page to open DocuSign. In DocuSign, click Start if prompted; your signature is on page 2 (use Next if you do not see it). No Shanken login is required. This works even if your company email blocks messages from DocuSign.';

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
  const buttonColor = exhibitorSigningAccentHex(productKeyFromEvent(p.event));

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; max-width: 620px; line-height: 1.55;">
      <p style="font-size:15px;">${messageHtml}</p>
      <p style="font-size:14px;color:#444;">${escapeHtml(docusignNote)}</p>
      <p style="margin:28px 0;">
        <a href="${escapeHtml(signingUrl)}"
           style="display:inline-block;padding:12px 20px;background:${buttonColor};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
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
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: false },
    },
  });
}

export function personalNudgeReturnUrl(
  event: EventEmailContext | null | undefined,
  contractId?: string | null,
): string {
  const base = `${appBaseUrlForProduct(productKeyFromEvent(event))}/signing/complete`;
  const id = contractId?.trim();
  return id ? `${base}?c=${encodeURIComponent(id)}` : base;
}
