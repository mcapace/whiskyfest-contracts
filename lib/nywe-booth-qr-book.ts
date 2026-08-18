import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import JSZip from 'jszip';
import { NYWE_EVENT_NAME } from '@/lib/nywe-copy';
import {
  ensureNyweBoothQrLink,
  listNyweExecutedBoothQrContracts,
  type NyweBoothQrContractRow,
} from '@/lib/nywe-booth-qr';
import { downloadRebrandlyQr } from '@/lib/rebrandly';
import { normalizeWineryWebsiteUrl } from '@/lib/winery-website';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const INK = rgb(0.15, 0.11, 0.1);
const MUTED = rgb(0.4, 0.36, 0.34);
const RULE = rgb(0.72, 0.62, 0.52);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = INK,
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size, font, color });
}

function safeFileStem(wineryName: string): string {
  return wineryName.replace(/[^\w]+/g, ' ').trim() || 'Winery';
}

export async function buildNyweBoothQrBook(input: {
  eventId: string;
  eventYear: number;
  eventName: string;
}): Promise<{ zip: Buffer; filename: string; readyCount: number; skippedCount: number }> {
  const contracts = await listNyweExecutedBoothQrContracts(input.eventId);
  const ready: NyweBoothQrContractRow[] = [];
  const missing: NyweBoothQrContractRow[] = [];
  for (const row of contracts) {
    if (normalizeWineryWebsiteUrl(row.exhibitor_website_url)) ready.push(row);
    else missing.push(row);
  }

  if (ready.length === 0) {
    throw new Error(
      missing.length > 0
        ? `No booth QRs to print — ${missing.length} executed license${missing.length === 1 ? '' : 's'} still need a winery website.`
        : 'No executed vendor licenses found for this event.',
    );
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const zip = new JSZip();
  const failed: { name: string; error: string }[] = [];

  const cover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cover.drawLine({
    start: { x: 72, y: PAGE_HEIGHT - 96 },
    end: { x: PAGE_WIDTH - 72, y: PAGE_HEIGHT - 96 },
    thickness: 0.75,
    color: RULE,
  });
  drawCentered(cover, NYWE_EVENT_NAME, PAGE_HEIGHT - 160, bold, 22);
  drawCentered(cover, 'Booth QR book', PAGE_HEIGHT - 196, font, 16, MUTED);
  drawCentered(cover, String(input.eventYear), PAGE_HEIGHT - 228, font, 14, MUTED);
  drawCentered(
    cover,
    `${ready.length} executed license${ready.length === 1 ? '' : 's'} with a website`,
    PAGE_HEIGHT - 300,
    font,
    12,
  );
  if (missing.length > 0) {
    drawCentered(
      cover,
      `${missing.length} executed license${missing.length === 1 ? '' : 's'} missing a website (listed at the back)`,
      PAGE_HEIGHT - 322,
      font,
      11,
      MUTED,
    );
  }
  drawCentered(
    cover,
    'Each QR encodes a winespectator.live short link.',
    120,
    font,
    10,
    MUTED,
  );

  for (const contract of ready) {
    try {
      const { shortUrl } = await ensureNyweBoothQrLink(contract, input.eventYear);
      const pngBody = await downloadRebrandlyQr(shortUrl, 'png');
      let svgBody: Buffer | null = null;
      try {
        svgBody = await downloadRebrandlyQr(shortUrl, 'svg');
      } catch {
        svgBody = null;
      }
      const stem = safeFileStem(contract.exhibitor_company_name);
      zip.file(`png/${stem} NYWE booth QR.png`, pngBody);
      if (svgBody) zip.file(`svg/${stem} NYWE booth QR.svg`, svgBody);

      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const image = await pdf.embedPng(pngBody);
      const qrSize = 320;
      const qrX = (PAGE_WIDTH - qrSize) / 2;
      const qrY = 280;
      page.drawImage(image, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      const nameLines = wrapText(contract.exhibitor_company_name, bold, 20, PAGE_WIDTH - 96);
      let nameY = PAGE_HEIGHT - 96;
      for (const line of nameLines.slice(0, 3)) {
        drawCentered(page, line, nameY, bold, 20);
        nameY -= 26;
      }
      drawCentered(page, NYWE_EVENT_NAME, nameY - 8, font, 11, MUTED);

      const shortHost = shortUrl.replace(/^https?:\/\//i, '');
      drawCentered(page, shortHost, 220, bold, 13);
      const website = normalizeWineryWebsiteUrl(contract.exhibitor_website_url);
      if (website) {
        drawCentered(page, website.replace(/^https?:\/\//i, '').replace(/\/$/, ''), 196, font, 10, MUTED);
      }
    } catch (err) {
      failed.push({
        name: contract.exhibitor_company_name,
        error: err instanceof Error ? err.message : 'Could not build QR',
      });
    }
  }

  if (missing.length > 0 || failed.length > 0) {
    const notes = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    notes.drawText('Could not include', { x: 72, y: PAGE_HEIGHT - 72, size: 16, font: bold, color: INK });
    let y = PAGE_HEIGHT - 108;
    const writeLines = (heading: string, lines: string[]) => {
      notes.drawText(heading, { x: 72, y, size: 11, font: bold, color: INK });
      y -= 18;
      for (const line of lines) {
        if (y < 72) return;
        notes.drawText(line.slice(0, 90), { x: 72, y, size: 10, font, color: MUTED });
        y -= 14;
      }
      y -= 10;
    };
    if (missing.length > 0) {
      writeLines(
        `Missing website (${missing.length})`,
        missing.map((row) => row.exhibitor_company_name),
      );
    }
    if (failed.length > 0) {
      writeLines(
        `Errors (${failed.length})`,
        failed.map((row) => `${row.name} — ${row.error}`),
      );
    }
  }

  const pdfBytes = Buffer.from(await pdf.save());
  zip.file(`${input.eventName.replace(/[^\w]+/g, ' ').trim() || 'NYWE'} ${input.eventYear} booth QR book.pdf`, pdfBytes);

  const zipBuffer = Buffer.from(
    await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }),
  );
  return {
    zip: zipBuffer,
    filename: `NYWE ${input.eventYear} booth QR book.zip`,
    readyCount: ready.length - failed.length,
    skippedCount: missing.length + failed.length,
  };
}
