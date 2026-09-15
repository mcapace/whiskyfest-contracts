export function defaultPersonalNudgeMessage(options: {
  signerName: string | null;
  exhibitorCompanyName: string;
  eventName: string;
  senderName: string;
}): string {
  const greeting = options.signerName?.trim() ? `Hi ${options.signerName.trim()},` : 'Hello,';
  const sender = options.senderName.trim() || 'The events team';
  return [
    greeting,
    '',
    `I wanted to follow up on the agreement for ${options.exhibitorCompanyName.trim() || 'your company'} (${options.eventName.trim()}).`,
    '',
    'When you have a moment, please review and sign the same agreement we sent earlier using the link below. If you have any questions, just reply to this email.',
    '',
    `Thank you,`,
    sender,
  ].join('\n');
}

/** One-click Send Reminder body — no custom message dialog. */
export function defaultReminderMessage(options: {
  signerName: string | null;
  exhibitorCompanyName: string;
  eventName: string;
  senderName: string;
}): string {
  const greeting = options.signerName?.trim() ? `Hi ${options.signerName.trim()},` : 'Hello,';
  const sender = options.senderName.trim() || 'The events team';
  const company = options.exhibitorCompanyName.trim() || 'your company';
  const eventName = options.eventName.trim() || 'the event';
  return [
    greeting,
    '',
    `This is a reminder to review and sign the agreement for ${company} (${eventName}).`,
    '',
    'Use the button below to open the same agreement we originally sent — not a new contract. If you have any questions, just reply to this email.',
    '',
    `Thank you,`,
    sender,
  ].join('\n');
}
