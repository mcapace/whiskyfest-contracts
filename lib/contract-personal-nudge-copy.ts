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
