import { eventContractDocumentLabel } from '@/lib/contract-template-profile';
import { isWineSpectatorProduct } from '@/lib/product-email';
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
  event: Pick<Event, 'name' | 'year' | 'contract_document_label' | 'product_key'>,
): string {
  const label = eventContractDocumentLabel(event);
  if (isWineSpectatorProduct(event.product_key)) {
    return `Please sign: ${event.name} vendor license — ${companyName}`;
  }
  return `Please sign: ${event.name} ${label} — ${companyName}`;
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
