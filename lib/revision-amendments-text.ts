import { splitAdditionalTermsItems } from '@/lib/contract-revision-plan';

/**
 * Text merged into {{revision_amendments}}: one amendment per paragraph, no blank lines, no
 * hand-typed numbering — the render pass turns the run of paragraphs into a numbered list and
 * removes the whole section when this is empty.
 */
export function revisionAmendmentsMergeText(raw: string | null | undefined): string {
  return splitAdditionalTermsItems(raw).join('\n');
}
