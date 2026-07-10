import { getSupabaseAdmin } from '@/lib/supabase';
import { parseContractRevisionPlan } from '@/lib/contract-revision-ai';
import { fetchGoogleDocPlainText } from '@/lib/google-doc-plain-text';
import { buildRevisionDocRequests } from '@/lib/google-doc-revision-requests';
import {
  type ContractRevisionContext,
  type ContractRevisionPlan,
  revisionAmendmentsFromPlan,
  revisionPlanToDisplayLines,
} from '@/lib/contract-revision-plan';
import { resolveContractTemplateDocId } from '@/lib/contract-template';
import { workspaceLabelForProduct } from '@/lib/product-email';
import { productKeyFromEvent } from '@/lib/product-portal';
import { downloadContractPdfFromStorage } from '@/lib/contract-pdf-storage';
import type { ContractWithTotals, Event } from '@/types/db';

async function extractPdfText(bytes: Buffer): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    const doc = await loadingTask.promise;
    const parts: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 12); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    return parts.join('\n');
  } catch {
    return '';
  }
}

function revisionContext(contract: ContractWithTotals, event: Event): ContractRevisionContext {
  const productKey = productKeyFromEvent(event);
  return {
    exhibitor_legal_name: contract.exhibitor_legal_name,
    exhibitor_company_name: contract.exhibitor_company_name,
    signer_1_name: contract.signer_1_name ?? '',
    signer_1_email: contract.signer_1_email ?? '',
    brands_poured: contract.brands_poured,
    event_name: event.name,
    product_label: workspaceLabelForProduct(productKey),
  };
}

export async function buildContractRevisionPlan(options: {
  contract: ContractWithTotals;
  event: Event;
  changeRequest: string;
  revisionUploadPath?: string | null;
}): Promise<{ plan: ContractRevisionPlan; preview_lines: string[] }> {
  const changeRequest = options.changeRequest.trim();
  if (changeRequest.length < 10) {
    throw new Error('Describe the client requested changes (at least 10 characters).');
  }

  const templateDocId = resolveContractTemplateDocId(options.contract, options.event);
  const templateExcerpt = await fetchGoogleDocPlainText(templateDocId);

  let uploadedPdfExcerpt: string | undefined;
  if (options.revisionUploadPath?.trim()) {
    const bytes = await downloadContractPdfFromStorage(options.revisionUploadPath.trim());
    const text = await extractPdfText(bytes);
    if (text.trim()) uploadedPdfExcerpt = text;
  }

  const plan = await parseContractRevisionPlan({
    changeRequest,
    context: revisionContext(options.contract, options.event),
    templateExcerpt,
    uploadedPdfExcerpt,
  });

  return { plan, preview_lines: revisionPlanToDisplayLines(plan) };
}

export async function loadContractAndEventForRevision(contractId: string): Promise<{
  contract: ContractWithTotals;
  event: Event;
}> {
  const supabase = getSupabaseAdmin();
  const { fetchContractWithTotalsById } = await import('@/lib/contract-with-totals');
  const contract = await fetchContractWithTotalsById(supabase, contractId);
  if (!contract) throw new Error('Contract not found');
  const { data: event } = await supabase.from('events').select('*').eq('id', contract.event_id).single<Event>();
  if (!event) throw new Error('Event not found');
  return { contract, event };
}

export function docRequestsForRevisionPlan(plan: ContractRevisionPlan) {
  return buildRevisionDocRequests(plan);
}

export function amendmentsTextForPlan(plan: ContractRevisionPlan): string | null {
  return revisionAmendmentsFromPlan(plan);
}
