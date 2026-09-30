import { extractPdfText } from '@/lib/contract-revision-plan-service';

/**
 * Turn whatever the client sent (emailed text, a Word doc, a PDF, a saved .eml) into plain text
 * the revision planner can read. Nothing is stored; the text lands in the wizard for review.
 */
export const AMENDMENT_IMPORT_MAX_BYTES = 15 * 1024 * 1024;
export const AMENDMENT_IMPORT_ACCEPT = '.pdf,.docx,.txt,.md,.eml,.rtf,application/pdf,text/plain,message/rfc822';

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Body of a saved email: drop the header block, prefer the text/plain part, fall back to stripped HTML. */
function emailBodyText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n');
  const boundary = normalized.match(/boundary="?([^";\n]+)"?/i)?.[1];
  if (boundary) {
    const parts = normalized.split(`--${boundary}`);
    const plain = parts.find((p) => /content-type:\s*text\/plain/i.test(p));
    const html = parts.find((p) => /content-type:\s*text\/html/i.test(p));
    const pick = plain ?? html;
    if (pick) {
      const body = pick.split(/\n\n/).slice(1).join('\n\n');
      const decoded = /quoted-printable/i.test(pick) ? decodeQuotedPrintable(body) : body;
      return plain ? decoded : stripHtml(decoded);
    }
  }
  const body = normalized.split(/\n\n/).slice(1).join('\n\n');
  return /<html|<body|<div|<p[\s>]/i.test(body) ? stripHtml(body) : body;
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function tidy(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractAmendmentsText(file: { name: string; type: string; bytes: Buffer }): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return tidy(await extractPdfText(file.bytes));
  }
  if (
    name.endsWith('.docx') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.bytes });
    return tidy(result.value);
  }
  if (name.endsWith('.eml') || type === 'message/rfc822') {
    return tidy(emailBodyText(file.bytes.toString('utf8')));
  }
  if (name.endsWith('.doc')) {
    throw new Error('Legacy .doc files are not supported — save the file as .docx or PDF and try again.');
  }
  const text = file.bytes.toString('utf8');
  return tidy(/<html|<body/i.test(text) ? stripHtml(text) : text);
}
