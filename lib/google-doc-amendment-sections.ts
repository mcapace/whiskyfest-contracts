import type { docs_v1 } from 'googleapis';
import { collectBodyParagraphs, normalizeForMatch, type LocatedParagraph } from '@/lib/google-doc-paragraph-edits';

/**
 * Finishing pass for the "ADDITIONAL TERMS AND AMENDMENTS" / "EXHIBITOR NOTES" blocks that the
 * templates carry above the signatures.
 *
 * - No amendments → the whole block (heading, intro sentence, blank lines) is removed, so a plain
 *   contract never shows an empty "Additional Terms" section.
 * - Amendments present → the heading is bolded and each amendment becomes a numbered item.
 * - Same treatment for the exhibitor-notes heading.
 */
const AMENDMENTS_HEADING = 'additional terms and amendments';
const AMENDMENTS_INTRO_PREFIX = 'the parties agree to the following modifications';
const NOTES_HEADING = 'exhibitor notes';

function isBlank(p: LocatedParagraph): boolean {
  return normalizeForMatch(p.text) === '';
}

function boldParagraph(p: LocatedParagraph): docs_v1.Schema$Request | null {
  const end = p.endIndex - 1;
  if (end <= p.startIndex) return null;
  return {
    updateTextStyle: {
      range: { startIndex: p.startIndex, endIndex: end },
      textStyle: { bold: true },
      fields: 'bold',
    },
  };
}

export function buildAmendmentSectionRequests(
  doc: docs_v1.Schema$Document,
  options: { hasAmendments: boolean; hasExhibitorNotes: boolean },
): docs_v1.Schema$Request[] {
  const paragraphs = collectBodyParagraphs(doc);
  const lastBodyEnd = doc.body?.content?.at(-1)?.endIndex ?? 0;
  const requests: Array<{ at: number; request: docs_v1.Schema$Request }> = [];

  const headingIdx = paragraphs.findIndex((p) => normalizeForMatch(p.text) === AMENDMENTS_HEADING);
  const notesIdx = paragraphs.findIndex(
    (p, i) => i > headingIdx && normalizeForMatch(p.text) === NOTES_HEADING,
  );

  if (headingIdx >= 0) {
    const heading = paragraphs[headingIdx];
    const introIdx = paragraphs.findIndex(
      (p, i) => i > headingIdx && normalizeForMatch(p.text).startsWith(AMENDMENTS_INTRO_PREFIX),
    );
    // Amendment items: the non-blank paragraphs between the intro sentence and the next heading.
    const stopIdx = notesIdx >= 0 ? notesIdx : paragraphs.length;
    const items = paragraphs.slice((introIdx >= 0 ? introIdx : headingIdx) + 1, stopIdx).filter((p) => !isBlank(p));

    if (options.hasAmendments && items.length > 0) {
      const bold = boldParagraph(heading);
      if (bold) requests.push({ at: heading.startIndex, request: bold });
      requests.push({
        at: items[0].startIndex,
        request: {
          createParagraphBullets: {
            range: { startIndex: items[0].startIndex, endIndex: items[items.length - 1].endIndex },
            bulletPreset: 'NUMBERED_DECIMAL_ALPHA_ROMAN',
          },
        },
      });
    } else if (!options.hasAmendments) {
      // Remove heading through the paragraph before the next heading (or through the intro + blanks).
      let deleteEnd: number;
      if (notesIdx >= 0) {
        deleteEnd = paragraphs[notesIdx].startIndex;
      } else {
        let lastIdx = introIdx >= 0 ? introIdx : headingIdx;
        while (lastIdx + 1 < paragraphs.length && isBlank(paragraphs[lastIdx + 1])) lastIdx += 1;
        deleteEnd = paragraphs[lastIdx].endIndex;
      }
      if (deleteEnd >= lastBodyEnd) deleteEnd = lastBodyEnd - 1;
      if (deleteEnd > heading.startIndex) {
        requests.push({
          at: heading.startIndex,
          request: { deleteContentRange: { range: { startIndex: heading.startIndex, endIndex: deleteEnd } } },
        });
      }
    }
  }

  if (notesIdx >= 0) {
    const notesHeading = paragraphs[notesIdx];
    if (options.hasExhibitorNotes) {
      const bold = boldParagraph(notesHeading);
      if (bold) requests.push({ at: notesHeading.startIndex, request: bold });
    } else {
      // Heading plus the blank paragraphs after it, up to the next content (signature anchors etc.).
      let lastIdx = notesIdx;
      while (lastIdx + 1 < paragraphs.length && isBlank(paragraphs[lastIdx + 1])) lastIdx += 1;
      let deleteEnd = paragraphs[lastIdx].endIndex;
      if (deleteEnd >= lastBodyEnd) deleteEnd = lastBodyEnd - 1;
      if (deleteEnd > notesHeading.startIndex) {
        requests.push({
          at: notesHeading.startIndex,
          request: {
            deleteContentRange: { range: { startIndex: notesHeading.startIndex, endIndex: deleteEnd } },
          },
        });
      }
    }
  }

  // Bottom-up keeps every index valid within the single batch.
  return requests.sort((a, b) => b.at - a.at).map((r) => r.request);
}
