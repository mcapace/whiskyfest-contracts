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
  /** Earlier replace / delete edits dropped because a later edit rewrites the same paragraph. */
  superseded: Array<{ op: ParagraphEditOp; anchor: string }>;
};

export type ParagraphEditOptions = {
  /**
   * The same document before phrase-level replacements ran. An anchor copied from the original
   * wording can stop matching once a phrase inside its paragraph was swapped; it is then located
   * in this snapshot and applied to the paragraph at the same position in the current document.
   */
  fallbackDoc?: docs_v1.Schema$Document;
};

/**
 * Build batchUpdate requests for a set of paragraph edits against the current document.
 * Requests are ordered by descending paragraph index so indices remain valid within one batch.
 * When several replace / delete edits land on one paragraph, the last one wins: plans are stored
 * in round order, so a later round's rewrite of a clause supersedes the earlier round's.
 */
export function buildParagraphEditRequests(
  doc: docs_v1.Schema$Document,
  edits: ParagraphEdit[],
  options?: ParagraphEditOptions,
): ParagraphEditPlanResult {
  const paragraphs = collectBodyParagraphs(doc);
  const fallbackParagraphs = options?.fallbackDoc ? collectBodyParagraphs(options.fallbackDoc) : null;
  const lastBodyEnd = doc.body?.content?.at(-1)?.endIndex ?? 0;
  const candidates: Array<{ edit: ParagraphEdit; target: LocatedParagraph }> = [];
  const unmatched: ParagraphEditPlanResult['unmatched'] = [];
  const superseded: ParagraphEditPlanResult['superseded'] = [];

  const locate = (anchor: string): ParagraphMatch => {
    const direct = findParagraphByAnchor(paragraphs, anchor);
    if (direct.ok || !fallbackParagraphs) return direct;
    const before = findParagraphByAnchor(fallbackParagraphs, anchor);
    if (!before.ok) return direct;
    const same = paragraphs[before.paragraph.index];
    return same ? { ok: true, paragraph: same } : direct;
  };

  for (const edit of edits) {
    const match = locate(edit.anchor);
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
    if ((edit.op === 'replace' || edit.op === 'insert_after') && !edit.text?.trim()) {
      unmatched.push({ op: edit.op, anchor: edit.anchor, reason: 'no replacement text supplied' });
      continue;
    }
    candidates.push({ edit, target: match.paragraph });
  }

  // Last replace / delete per paragraph wins; inserts after a paragraph are all kept.
  const lastRewrite = new Map<number, number>();
  candidates.forEach(({ edit, target }, i) => {
    if (edit.op !== 'insert_after') lastRewrite.set(target.index, i);
  });
  const planned = candidates.filter(({ edit, target }, i) => {
    if (edit.op === 'insert_after' || lastRewrite.get(target.index) === i) return true;
    superseded.push({ op: edit.op, anchor: edit.anchor });
    return false;
  });

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

  return { requests, applied, unmatched, superseded };
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

/** Every text run in the document, tables included. */
export function documentPlainText(doc: docs_v1.Schema$Document): string {
  const walk = (elements: docs_v1.Schema$StructuralElement[] | undefined): string => {
    let out = '';
    for (const el of elements ?? []) {
      for (const run of el.paragraph?.elements ?? []) out += run.textRun?.content ?? '';
      for (const row of el.table?.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) out += walk(cell.content);
      }
    }
    return out;
  };
  return walk(doc.body?.content);
}

/**
 * A phrase edit whose find text is gone can still be satisfied: a deletion of text that is no
 * longer there, or a replacement whose new wording is already in the document (an earlier round
 * swapped the same phrase, or a clause rewrite carried it). Only the finds that leave the
 * document short of the intended wording are returned.
 */
export function unsatisfiedReplaceAllText(
  requests: docs_v1.Schema$Request[],
  unmatchedFinds: string[],
  doc: docs_v1.Schema$Document,
): string[] {
  if (unmatchedFinds.length === 0) return [];
  const text = normalizeForMatch(documentPlainText(doc));
  return unmatchedFinds.filter((find) => {
    const req = requests.find((r) => r.replaceAllText?.containsText?.text === find);
    const replacement = normalizeForMatch(req?.replaceAllText?.replaceText ?? '');
    if (!replacement) return false;
    return !text.includes(replacement);
  });
}
