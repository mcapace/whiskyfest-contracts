import type { docs_v1 } from 'googleapis';

/**
 * Paragraph-level edits for a merged contract Google Doc.
 *
 * `replaceAllText` can only swap phrases. Real amendments replace a whole clause, drop a bullet,
 * or add a numbered term after an existing one — and they must keep the surrounding formatting
 * (bullets, bold run-in headings, numbering). These helpers read the document structure, locate
 * paragraphs by an anchor phrase, and emit index-based requests that are applied bottom-up so
 * earlier indices stay valid.
 */

export type ParagraphEditOp = 'replace' | 'delete' | 'insert_after';

export type ParagraphEdit = {
  op: ParagraphEditOp;
  /** Distinctive phrase that appears in exactly one body paragraph (case/whitespace-insensitive). */
  anchor: string;
  /** New paragraph text for replace / insert_after. Newlines create additional paragraphs. */
  text?: string;
};

export type LocatedParagraph = {
  index: number;
  startIndex: number;
  endIndex: number;
  text: string;
  paragraph: docs_v1.Schema$Paragraph;
};

export function normalizeForMatch(value: string): string {
  return value
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function paragraphText(p: docs_v1.Schema$Paragraph | undefined): string {
  return (p?.elements ?? []).map((el) => el.textRun?.content ?? '').join('');
}

/** Body paragraphs (tables excluded — clause edits never target the order table). */
export function collectBodyParagraphs(doc: docs_v1.Schema$Document): LocatedParagraph[] {
  const out: LocatedParagraph[] = [];
  let i = 0;
  for (const el of doc.body?.content ?? []) {
    if (!el.paragraph || el.startIndex == null || el.endIndex == null) continue;
    out.push({
      index: i++,
      startIndex: el.startIndex,
      endIndex: el.endIndex,
      text: paragraphText(el.paragraph),
      paragraph: el.paragraph,
    });
  }
  return out;
}

export type ParagraphMatch =
  | { ok: true; paragraph: LocatedParagraph }
  | { ok: false; reason: 'not_found' | 'ambiguous'; count: number };

export function findParagraphByAnchor(paragraphs: LocatedParagraph[], anchor: string): ParagraphMatch {
  const needle = normalizeForMatch(anchor);
  if (!needle) return { ok: false, reason: 'not_found', count: 0 };
  const hits = paragraphs.filter((p) => normalizeForMatch(p.text).includes(needle));
  if (hits.length === 1) return { ok: true, paragraph: hits[0] };
  if (hits.length === 0) return { ok: false, reason: 'not_found', count: 0 };
  // Prefer an exact whole-paragraph match when the anchor is the full paragraph text.
  const exact = hits.filter((p) => normalizeForMatch(p.text) === needle);
  if (exact.length === 1) return { ok: true, paragraph: exact[0] };
  return { ok: false, reason: 'ambiguous', count: hits.length };
}

/** Text runs whose style should carry to replacement text (bold run-in headings etc. are dropped on purpose). */
function baseTextStyle(p: docs_v1.Schema$Paragraph): docs_v1.Schema$TextStyle | undefined {
  const runs = (p.elements ?? []).filter((el) => el.textRun && (el.textRun.content ?? '').trim());
  // The last run is the body text of a "Heading. body…" paragraph; the first run may be bold.
  const run = runs.at(-1) ?? runs[0];
  if (!run?.textRun?.textStyle) return undefined;
  const { bold: _bold, ...rest } = run.textRun.textStyle;
  return rest;
}

export type ParagraphEditPlanResult = {
  requests: docs_v1.Schema$Request[];
  applied: Array<{ op: ParagraphEditOp; anchor: string }>;
  unmatched: Array<{ op: ParagraphEditOp; anchor: string; reason: string }>;
};

/**
 * Build batchUpdate requests for a set of paragraph edits against the current document.
 * Requests are ordered by descending paragraph index so indices remain valid within one batch.
 */
export function buildParagraphEditRequests(
  doc: docs_v1.Schema$Document,
  edits: ParagraphEdit[],
): ParagraphEditPlanResult {
  const paragraphs = collectBodyParagraphs(doc);
  const lastBodyEnd = doc.body?.content?.at(-1)?.endIndex ?? 0;
  const planned: Array<{ edit: ParagraphEdit; target: LocatedParagraph }> = [];
  const unmatched: ParagraphEditPlanResult['unmatched'] = [];
  const usedParagraphs = new Set<number>();

  for (const edit of edits) {
    const match = findParagraphByAnchor(paragraphs, edit.anchor);
    if (!match.ok) {
      unmatched.push({
        op: edit.op,
        anchor: edit.anchor,
        reason:
          match.reason === 'ambiguous'
            ? `matches ${match.count} paragraphs — use a longer, more specific phrase`
            : 'no paragraph contains this phrase',
      });
      continue;
    }
    if (edit.op !== 'insert_after' && usedParagraphs.has(match.paragraph.index)) {
      unmatched.push({ op: edit.op, anchor: edit.anchor, reason: 'another edit already targets this paragraph' });
      continue;
    }
    if ((edit.op === 'replace' || edit.op === 'insert_after') && !edit.text?.trim()) {
      unmatched.push({ op: edit.op, anchor: edit.anchor, reason: 'no replacement text supplied' });
      continue;
    }
    if (edit.op !== 'insert_after') usedParagraphs.add(match.paragraph.index);
    planned.push({ edit, target: match.paragraph });
  }

  // Bottom-up so each request's indices are unaffected by the ones before it.
  planned.sort((a, b) => b.target.startIndex - a.target.startIndex || (a.edit.op === 'insert_after' ? -1 : 1));

  const requests: docs_v1.Schema$Request[] = [];
  const applied: ParagraphEditPlanResult['applied'] = [];

  for (const { edit, target } of planned) {
    const text = (edit.text ?? '').replace(/\r\n/g, '\n').trim();
    const style = baseTextStyle(target.paragraph);
    // Paragraph content excludes its trailing newline; the final body paragraph's newline cannot be deleted.
    const contentEnd = target.endIndex - 1;
    const isLast = target.endIndex >= lastBodyEnd;

    if (edit.op === 'delete') {
      if (isLast) {
        if (contentEnd > target.startIndex) {
          requests.push({ deleteContentRange: { range: { startIndex: target.startIndex, endIndex: contentEnd } } });
        }
      } else {
        requests.push({
          deleteContentRange: { range: { startIndex: target.startIndex, endIndex: target.endIndex } },
        });
      }
      applied.push({ op: edit.op, anchor: edit.anchor });
      continue;
    }

    if (edit.op === 'replace') {
      if (contentEnd > target.startIndex) {
        requests.push({ deleteContentRange: { range: { startIndex: target.startIndex, endIndex: contentEnd } } });
      }
      requests.push({ insertText: { location: { index: target.startIndex }, text } });
      if (style) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: target.startIndex, endIndex: target.startIndex + text.length },
            textStyle: style,
            fields: 'bold,italic,underline,fontSize,weightedFontFamily,foregroundColor',
          },
        });
      }
      applied.push({ op: edit.op, anchor: edit.anchor });
      continue;
    }

    // insert_after: "\n" + text before the anchor's trailing newline creates a sibling paragraph
    // that inherits the anchor's paragraph style (bullets / numbering included).
    requests.push({ insertText: { location: { index: contentEnd }, text: `\n${text}` } });
    if (style) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: contentEnd + 1, endIndex: contentEnd + 1 + text.length },
          textStyle: style,
          fields: 'bold,italic,underline,fontSize,weightedFontFamily,foregroundColor',
        },
      });
    }
    applied.push({ op: edit.op, anchor: edit.anchor });
  }

  return { requests, applied, unmatched };
}

/** Docs `replaceAllText` replies carry occurrencesChanged; zero means the find string was not in the doc. */
export function unmatchedReplaceAllText(
  requests: docs_v1.Schema$Request[],
  replies: docs_v1.Schema$Response[] | undefined,
): string[] {
  const missing: string[] = [];
  requests.forEach((req, i) => {
    const find = req.replaceAllText?.containsText?.text;
    if (!find) return;
    const changed = replies?.[i]?.replaceAllText?.occurrencesChanged ?? 0;
    if (!changed) missing.push(find);
  });
  return missing;
}
