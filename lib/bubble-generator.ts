import { randomInt } from 'node:crypto';

export type BubbleContentType = 'fact' | 'joke' | 'quote';

export type GeneratedBubble = {
  content_type: BubbleContentType;
  content: string;
  attribution: string | null;
};

function pickRandomType(): BubbleContentType {
  const types: BubbleContentType[] = ['fact', 'joke', 'quote'];
  return types[randomInt(0, types.length)]!;
}

function buildPrompt(type: BubbleContentType): string {
  if (type === 'fact') {
    return `Generate a single interesting fact about whisky, spirits, cocktails, or distilling history.
Requirements:

Under 200 characters including any punctuation
Factually accurate — if you're not certain it's true, don't say it
Interesting enough to be worth reading but not trivial
Professional tone, informative
Avoid very common/obvious facts (e.g., "whisky is made from grain")

Respond with ONLY the fact itself, no preamble, no "Did you know" prefix, no "fun fact" labels.
Example format:
Scottish distilleries traditionally fill their barrels at 63.5% ABV — slightly higher than what they bottle at — to leave room for the angel's share during aging.`;
  }
  if (type === 'joke') {
    return `Generate a single clever joke or pun about whisky, spirits, or drinking culture.
Requirements:

Under 180 characters including punctuation
Clever rather than corny
Professional/workplace-appropriate
Not offensive or stereotyping any culture
Pun-based or observational humor, not requiring context

Respond with ONLY the joke itself, no preamble, no "here's a joke" labels.
Example format:
A whisky enthusiast walks into a bar. He orders a single malt. The bartender says 'nice to see someone keeping it neat.'`;
  }
  return `Provide a real, verified quote about whisky, spirits, or drinking by a historical figure, author, or notable personality.
Requirements:

Real quote (no fabrications)
Under 180 characters including punctuation and attribution line
Notable source (author, politician, actor, musician, etc.)
Professional/workplace-appropriate

Respond ONLY with the quote itself, THEN on a new line write: ATTRIBUTION: [Person's name]
Example format:
The water was not fit to drink. To make it palatable, we had to add whisky. By diligent effort, I learned to like it.
ATTRIBUTION: Winston Churchill`;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function parseResponse(raw: string, type: BubbleContentType): GeneratedBubble {
  const text = raw.trim();
  if (type === 'quote') {
    const idx = text.search(/\n?\s*ATTRIBUTION:\s*/i);
    if (idx === -1) {
      return { content_type: type, content: truncate(text, 250), attribution: null };
    }
    const quotePart = text.slice(0, idx).trim();
    const attrPart = text.slice(idx).replace(/^\n?\s*ATTRIBUTION:\s*/i, '').trim();
    return {
      content_type: type,
      content: truncate(quotePart, 250),
      attribution: attrPart ? truncate(attrPart, 120) : null,
    };
  }
  return { content_type: type, content: truncate(text, 250), attribution: null };
}

type AnthropicContentBlock = { type: string; text?: string };

/**
 * Calls Claude to produce today's bubble copy. Throws on HTTP/parsing failure (caller skips DB insert).
 */
export async function generateDailyBubble(): Promise<GeneratedBubble> {
  const apiKey = process.env['ANTHROPIC_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const type = pickRandomType();
  const prompt = buildPrompt(type);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = (await response.json()) as {
    content?: AnthropicContentBlock[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `Anthropic API error ${response.status}`);
  }

  const block = data.content?.find((c) => c.type === 'text');
  const rawText = block?.text?.trim();
  if (!rawText) {
    throw new Error('Anthropic returned no text content');
  }

  const parsed = parseResponse(rawText, type);
  if (!parsed.content) {
    throw new Error('Parsed bubble content was empty');
  }
  return parsed;
}
