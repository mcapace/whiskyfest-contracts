import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import JSZip from 'jszip';
import { NYWE_EVENT_NAME } from '@/lib/nywe-copy';
import { nyweBoothQrDownloadFilename, nyweBoothQrFileStem } from '@/lib/nywe-art-codes';
import {
  ensureNyweBoothQrLink,
  listNyweExecutedBoothQrContracts,
  type NyweBoothQrContractRow,
} from '@/lib/nywe-booth-qr';
import { generateQrBuffer } from '@/lib/rebrandly';
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

function artCodeSortKey(value: string | null | undefined): number {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** One print asset per art code (or per contract when art code is missing). */
function dedupeForPrint(rows: NyweBoothQrContractRow[]): NyweBoothQrContractRow[] {
  const byKey = new Map<string, NyweBoothQrContractRow>();
  for (const row of rows) {
    const key = row.art_code?.trim() || `id:${row.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const preferNew =
      Boolean(row.rebrandly_short_url) && !existing.rebrandly_short_url
        ? true
        : Boolean(normalizeWineryWebsiteUrl(row.exhibitor_website_url)) &&
            !normalizeWineryWebsiteUrl(existing.exhibitor_website_url);
    if (preferNew) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => {
    const artDiff = artCodeSortKey(a.art_code) - artCodeSortKey(b.art_code);
    if (artDiff !== 0) return artDiff;
    const boothDiff = artCodeSortKey(a.booth_number) - artCodeSortKey(b.booth_number);
    if (boothDiff !== 0) return boothDiff;
    return a.exhibitor_company_name.localeCompare(b.exhibitor_company_name, undefined, {
      sensitivity: 'base',
    });
  });
}

export async function buildNyweBoothQrBook(input: {
  eventId: string;
  eventYear: number;
  eventName: string;
}): Promise<{ zip: Buffer; filename: string; readyCount: number; skippedCount: number }> {
  const contracts = await listNyweExecutedBoothQrContracts(input.eventId);
  const withWebsite: NyweBoothQrContractRow[] = [];
  const missing: NyweBoothQrContractRow[] = [];
  for (const row of contracts) {
    if (normalizeWineryWebsiteUrl(row.exhibitor_website_url)) withWebsite.push(row);
    else missing.push(row);
  }

  const ready = dedupeForPrint(withWebsite);
  const missingUnique = dedupeForPrint(missing);

  if (ready.length === 0) {
    throw new Error(
      missingUnique.length > 0
        ? `No booth QRs to print — ${missingUnique.length} executed license${missingUnique.length === 1 ? '' : 's'} still need a winery website.`
        : 'No executed vendor licenses found for this event.',
    );
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const zip = new JSZip();
  const failed: { name: string; error: string }[] = [];
  const withArtCode = ready.filter((row) => row.art_code?.trim()).length;

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
    `${ready.length} print QR${ready.length === 1 ? '' : 's'} · ${withArtCode} named by art code`,
    PAGE_HEIGHT - 300,
    font,
    12,
  );
  if (missingUnique.length > 0) {
    drawCentered(
      cover,
      `${missingUnique.length} executed license${missingUnique.length === 1 ? '' : 's'} missing a website (listed at the back)`,
      PAGE_HEIGHT - 322,
      font,
      11,
      MUTED,
    );
  }
  drawCentered(
    cover,
    'PNG/SVG filenames use art codes when available.',
    140,
    font,
    10,
    MUTED,
  );
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
      const pngBody = await generateQrBuffer(shortUrl, 'png', 512);
      const svgBody = await generateQrBuffer(shortUrl, 'svg');
      const stem = nyweBoothQrFileStem({
        artCode: contract.art_code,
        wineryName: contract.exhibitor_company_name,
      });
      zip.file(
        `png/${nyweBoothQrDownloadFilename({
          artCode: contract.art_code,
          wineryName: contract.exhibitor_company_name,
          format: 'png',
        })}`,
        pngBody,
      );
      zip.file(
        `svg/${nyweBoothQrDownloadFilename({
          artCode: contract.art_code,
          wineryName: contract.exhibitor_company_name,
          format: 'svg',
        })}`,
        svgBody,
      );

      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      const image = await pdf.embedPng(pngBody);
      const qrSize = 320;
      const qrX = (PAGE_WIDTH - qrSize) / 2;
      const qrY = 260;
      page.drawImage(image, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      const art = contract.art_code?.trim();
      let nameY = PAGE_HEIGHT - 88;
      if (art) {
        drawCentered(page, `Art code ${art}`, nameY, bold, 22);
        nameY -= 30;
        if (contract.booth_number?.trim()) {
          drawCentered(page, `Booth ${contract.booth_number.trim()}`, nameY, font, 12, MUTED);
          nameY -= 22;
        }
      }

      const nameLines = wrapText(contract.exhibitor_company_name, art ? font : bold, art ? 14 : 20, PAGE_WIDTH - 96);
      for (const line of nameLines.slice(0, 3)) {
        drawCentered(page, line, nameY, art ? font : bold, art ? 14 : 20);
        nameY -= art ? 18 : 26;
      }
      drawCentered(page, NYWE_EVENT_NAME, nameY - 4, font, 11, MUTED);

      const shortHost = shortUrl.replace(/^https?:\/\//i, '');
      drawCentered(page, shortHost, 200, bold, 13);
      const website = normalizeWineryWebsiteUrl(contract.exhibitor_website_url);
      if (website) {
        drawCentered(page, website.replace(/^https?:\/\//i, '').replace(/\/$/, ''), 176, font, 10, MUTED);
      }
      if (!art) {
        drawCentered(page, `File: ${stem}`, 150, font, 9, MUTED);
      }
    } catch (err) {
      failed.push({
        name: contract.art_code?.trim()
          ? `${contract.art_code} · ${contract.exhibitor_company_name}`
          : contract.exhibitor_company_name,
        error: err instanceof Error ? err.message : 'Could not build QR',
      });
    }
  }

  if (missingUnique.length > 0 || failed.length > 0) {
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
    if (missingUnique.length > 0) {
      writeLines(
        `Missing website (${missingUnique.length})`,
        missingUnique.map((row) =>
          row.art_code?.trim()
            ? `${row.art_code} · ${row.exhibitor_company_name}`
            : row.exhibitor_company_name,
        ),
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
    await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }),
  );
  return {
    zip: zipBuffer,
    filename: `NYWE ${input.eventYear} booth QR book.zip`,
    readyCount: ready.length - failed.length,
    skippedCount: missingUnique.length + failed.length,
  };
}
