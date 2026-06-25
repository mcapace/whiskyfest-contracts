import { eventContractDocumentLabel } from '@/lib/contract-template-profile';
import { isWineSpectatorProduct } from '@/lib/product-email';
import type { Event } from '@/types/db';

/** DocuSign envelope email subject limit. */
export const DOCUSIGN_EMAIL_SUBJECT_MAX = 100;

/** Merge tokens for event.docusign_email_subject_template. */
export const DOCUSIGN_EMAIL_SUBJECT_TOKENS = [
  '{{winery_name}}',
  '{{event_name}}',
  '{{document_label}}',
  '{{event_year}}',
] as const;

export function contractPdfBaseName(
  companyName: string,
  event: Pick<Event, 'name' | 'year' | 'contract_document_label'>,
): string {
  const safeCompany = companyName.replace(/[^\w\s-]/g, '').trim();
  const label = eventContractDocumentLabel(event);
  return `${safeCompany} — ${event.name} ${label}`;
}

export function contractDocuSignFileName(
  companyName: string,
  event: Pick<Event, 'name' | 'year' | 'contract_document_label'>,
): string {
  return `${contractPdfBaseName(companyName, event)}.pdf`;
}

export function defaultDocuSignEmailSubjectTemplate(
  event: Pick<Event, 'product_key' | 'contract_document_label'>,
): string {
  if (isWineSpectatorProduct(event.product_key)) {
    return '{{winery_name}} — Please sign your {{event_name}} vendor license';
  }
  return '{{winery_name}} — Please sign your {{event_name}} {{document_label}}';
}

export function mergeDocuSignEmailSubjectTemplate(
  template: string,
  companyName: string,
  event: Pick<Event, 'name' | 'year' | 'contract_document_label'>,
): string {
  const winery = companyName.trim();
  const label = eventContractDocumentLabel(event);
  const merged = template
    .replaceAll('{{winery_name}}', winery)
    .replaceAll('{{exhibitor_company_name}}', winery)
    .replaceAll('{{event_name}}', event.name.trim())
    .replaceAll('{{document_label}}', label)
    .replaceAll('{{event_year}}', String(event.year))
    .replace(/\s+/g, ' ')
    .trim();

  return merged.length <= DOCUSIGN_EMAIL_SUBJECT_MAX
    ? merged
    : merged.slice(0, DOCUSIGN_EMAIL_SUBJECT_MAX).trimEnd();
}

export function contractDocuSignEmailSubject(
  companyName: string,
  event: Pick<
    Event,
    'name' | 'year' | 'contract_document_label' | 'product_key' | 'docusign_email_subject_template'
  >,
): string {
  const template =
    event.docusign_email_subject_template?.trim() || defaultDocuSignEmailSubjectTemplate(event);
  return mergeDocuSignEmailSubjectTemplate(template, companyName, event);
}

export function contractDocuSignEmailBlurb(
  companyName: string,
  event: Pick<Event, 'name' | 'year' | 'contract_document_label' | 'product_key'>,
): string {
  const label = eventContractDocumentLabel(event);
  if (isWineSpectatorProduct(event.product_key)) {
    return `Please review and sign your Wine Spectator ${event.name} vendor license for ${companyName}.`;
  }
  return `Attached is the ${event.name} ${label} for ${companyName}. Please review and sign.`;
}
