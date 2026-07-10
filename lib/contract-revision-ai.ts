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

MASTER TEMPLATE TEXT (excerpt — use exact phrases from here for find/replace and deletions):
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
    "payment_terms": "e.g. Net 60"
  },
  "text_replacements": [
    { "find": "exact phrase in template", "replace": "new phrase", "reason": "short label" }
  ],
  "text_deletions": [
    { "find": "exact phrase or sentence to remove from template", "reason": "short label" }
  ],
  "additional_terms": "only if a change cannot be applied inline — otherwise empty string"
}

RULES:
1. Party/name changes: set field_updates AND add text_replacements for every distinct old name string that appears in the template excerpt (e.g. replace all occurrences of the old legal name).
2. Payment term changes: set field_updates.payment_terms AND add text_replacements for the exact old payment phrase found in the template (e.g. "Net 30" → "Net 60").
3. Deletions: use text_deletions with the most specific phrase or sentence from the template that should be removed (e.g. Med Exp insurance sentence). Prefer deleting the full sentence.
4. Use find strings that literally appear in the template excerpt — do not invent text.
5. Do not duplicate the same find string in both replacements and deletions.
6. Keep additional_terms empty when inline edits cover the request.
7. Be conservative: if unsure of exact template wording, put clarifying language in additional_terms instead of guessing a find string.`;
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
