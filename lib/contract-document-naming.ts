import { eventContractDocumentLabel } from '@/lib/contract-template-profile';
import type { Event } from '@/types/db';

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

export function contractDocuSignEmailSubject(
  companyName: string,
  event: Pick<Event, 'name' | 'year' | 'contract_document_label'>,
): string {
  const label = eventContractDocumentLabel(event);
  return `Please sign: ${event.name} ${label} — ${companyName}`;
}

export function contractDocuSignEmailBlurb(
  companyName: string,
  event: Pick<Event, 'name' | 'year' | 'contract_document_label'>,
): string {
  const label = eventContractDocumentLabel(event);
  return `Attached is the ${event.name} ${label} for ${companyName}. Please review and sign.`;
}
