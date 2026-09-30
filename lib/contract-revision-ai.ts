import {
  type ContractRevisionContext,
  type ContractRevisionPlan,
  contractRevisionPlanSchema,
} from '@/lib/contract-revision-plan';

const DEFAULT_REVISION_MODEL = 'claude-sonnet-4-6';

type AnthropicContentBlock = { type: string; text?: string };

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain JSON');
  }
  return JSON.parse(body.slice(start, end + 1));
}

function buildRevisionPrompt(options: {
  changeRequest: string;
  context: ContractRevisionContext;
  templateExcerpt: string;
  uploadedPdfExcerpt?: string;
}): string {
  const { changeRequest, context, templateExcerpt, uploadedPdfExcerpt } = options;
  return `You are a contract operations assistant for ${context.product_label}. Parse client-requested contract revisions into a structured edit plan that can be applied to a Google Docs contract template.

CURRENT CONTRACT DATA:
- Exhibitor legal name: ${context.exhibitor_legal_name}
- Exhibitor company name: ${context.exhibitor_company_name}
- Signer: ${context.signer_1_name} <${context.signer_1_email}>
- Brands: ${context.brands_poured ?? '(none)'}
- Event: ${context.event_name}

CLIENT REQUESTED CHANGES:
${changeRequest.trim()}

CURRENT CONTRACT TEXT (merged, one paragraph per line, numbered [P#] for reference only — the numbers are not in the document):
${templateExcerpt.slice(0, 28000)}

${uploadedPdfExcerpt ? `UPLOADED REDLINE PDF TEXT (excerpt):\n${uploadedPdfExcerpt.slice(0, 12000)}\n` : ''}

Return ONLY valid JSON matching this schema:
{
  "summary": "1-3 sentence summary of changes for the events team",
  "field_updates": {
    "exhibitor_legal_name": "optional new legal name",
    "exhibitor_company_name": "optional new company name",
    "signer_1_name": "optional",
    "signer_1_email": "optional",
    "signer_2_name": "optional second client signatory",
    "signer_2_email": "optional",
    "payment_terms": "e.g. Net 60"
  },
  "text_replacements": [
    { "find": "exact phrase in the contract", "replace": "new phrase", "reason": "short label" }
  ],
  "text_deletions": [
    { "find": "exact phrase or sentence to remove", "reason": "short label" }
  ],
  "paragraph_edits": [
    { "op": "replace", "anchor": "distinctive phrase from the paragraph being replaced", "text": "the complete new paragraph", "reason": "short label" },
    { "op": "delete", "anchor": "distinctive phrase from the paragraph to remove", "reason": "short label" },
    { "op": "insert_after", "anchor": "distinctive phrase from the paragraph it follows", "text": "the complete new paragraph", "reason": "short label" }
  ],
  "additional_terms": "one numbered term per line — only when a change cannot be placed inline; otherwise empty string"
}

HOW TO CHOOSE THE EDIT TYPE:
- A clause, bullet, or whole sentence-paragraph is rewritten → paragraph_edits.replace with the FULL new paragraph text (keep any run-in heading such as "6 Indemnification." at the start).
- A clause or bullet is struck entirely → paragraph_edits.delete.
- A new clause or bullet is added → paragraph_edits.insert_after, anchored to the paragraph it should follow (it inherits that paragraph's numbering / bullet style).
- A few words change inside a paragraph (a name, a number, "Net 30" → "Net 60") → text_replacements.
- A sentence is removed from a longer paragraph → text_deletions with the full sentence.
- Only when none of the above can place the change → additional_terms.

RULES:
1. Anchors and find strings must be copied verbatim from the CURRENT CONTRACT TEXT (case may differ, punctuation may not). Never include the [P#] label.
2. An anchor must identify exactly ONE paragraph: use 6-15 consecutive words that appear nowhere else.
3. Party/name changes: set field_updates AND add text_replacements for every distinct old name string that appears in the contract.
4. Payment term changes: set field_updates.payment_terms AND add text_replacements for the exact old payment phrase.
5. Do not target the same paragraph with two paragraph_edits, and do not duplicate a find string across replacements and deletions.
6. Keep additional_terms empty when inline edits cover the request.
7. Be conservative: if unsure of exact contract wording, put clarifying language in additional_terms instead of guessing.`;
}

export async function parseContractRevisionPlan(options: {
  changeRequest: string;
  context: ContractRevisionContext;
  templateExcerpt: string;
  uploadedPdfExcerpt?: string;
}): Promise<ContractRevisionPlan> {
  const apiKey = process.env['ANTHROPIC_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — AI revision parsing is unavailable.');
  }

  const model = process.env['ANTHROPIC_REVISION_MODEL']?.trim() || DEFAULT_REVISION_MODEL;
  const prompt = buildRevisionPrompt(options);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = (await response.json()) as {
    content?: AnthropicContentBlock[];
    error?: { message?: string };
  };

  if (!response.ok) {
    const detail = data.error?.message ?? `Anthropic API error ${response.status}`;
    throw new Error(detail);
  }

  const block = data.content?.find((c) => c.type === 'text');
  const rawText = block?.text?.trim();
  if (!rawText) throw new Error('AI returned no revision plan');

  const parsed = extractJsonObject(rawText);
  const result = contractRevisionPlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid revision plan from AI: ${result.error.message}`);
  }
  return result.data;
}
