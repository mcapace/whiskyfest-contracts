import type { docs_v1 } from 'googleapis';
import type { ContractRevisionPlan } from '@/lib/contract-revision-plan';

export type GoogleDocsBatchRequest = docs_v1.Schema$Request;

/** Build Google Docs batchUpdate requests to apply inline template edits after merge tokens. */
export function buildRevisionDocRequests(plan: ContractRevisionPlan): GoogleDocsBatchRequest[] {
  const requests: GoogleDocsBatchRequest[] = [];
  const seen = new Set<string>();

  const addReplace = (find: string, replace: string) => {
    const key = `${find}\0${replace}`;
    if (!find.trim() || seen.has(key)) return;
    seen.add(key);
    requests.push({
      replaceAllText: {
        containsText: { text: find, matchCase: false },
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
    // Common WF/NYWE template phrases — applied when present after merge.
    const normalized = paymentTerms.replace(/\s+/g, ' ');
    if (/net\s*\d+/i.test(normalized)) {
      addReplace('Net 30', normalized);
      addReplace('net 30', normalized);
      addReplace('NET 30', normalized.toUpperCase());
      addReplace('Net thirty (30)', normalized);
      addReplace('thirty (30) days', normalized.replace(/net\s*/i, ''));
    }
  }

  return requests;
}
