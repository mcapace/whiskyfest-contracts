import type { docs_v1 } from 'googleapis';
import type { ContractRevisionPlan } from '@/lib/contract-revision-plan';

export type GoogleDocsBatchRequest = docs_v1.Schema$Request;

const NUMBER_WORDS: Record<string, string> = {
  '15': 'fifteen',
  '30': 'thirty',
  '45': 'forty-five',
  '60': 'sixty',
  '90': 'ninety',
  '120': 'one hundred twenty',
};

/**
 * Phrase-level `replaceAllText` requests for a revision plan (text replacements, deletions and the
 * common payment-term phrasings). Clause-level edits live in lib/google-doc-paragraph-edits.ts.
 */
export function buildRevisionDocRequests(plan: ContractRevisionPlan): GoogleDocsBatchRequest[] {
  const requests: GoogleDocsBatchRequest[] = [];
  const seen = new Set<string>();

  const addReplace = (find: string, replace: string, matchCase = false) => {
    const key = `${find}\0${replace}`;
    if (!find.trim() || seen.has(key)) return;
    seen.add(key);
    requests.push({
      replaceAllText: {
        containsText: { text: find, matchCase },
        replaceText: replace,
      },
    });
  };

  for (const r of plan.text_replacements) {
    addReplace(r.find, r.replace);
  }
  for (const d of plan.text_deletions) {
    addReplace(d.find, '');
  }

  const paymentTerms = plan.field_updates?.payment_terms?.trim();
  if (paymentTerms) {
    const normalized = paymentTerms.replace(/\s+/g, ' ');
    const days = normalized.match(/net\s*(\d+)/i)?.[1];
    if (days) {
      // replaceAllText is case-insensitive here, so one request covers Net 30 / net 30 / NET 30.
      addReplace('Net 30', `Net ${days}`);
      const word = NUMBER_WORDS[days];
      if (word) {
        addReplace('Net thirty (30)', `Net ${word} (${days})`);
        addReplace('thirty (30) days', `${word} (${days}) days`);
      }
    }
  }

  return requests;
}
