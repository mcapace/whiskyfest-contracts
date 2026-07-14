import { PRODUCT_BIG_SMOKE, PRODUCT_WINE_SPECTATOR } from '@/lib/product-portal';
import type { Event } from '@/types/db';

export const CONTRACT_TEMPLATE_PROFILES = ['whiskyfest', 'nywe_vendor', 'big_smoke'] as const;
export type ContractTemplateProfile = (typeof CONTRACT_TEMPLATE_PROFILES)[number];

export const WORKFLOW_PROFILES = ['sales_rep', 'events_managed'] as const;
export type WorkflowProfile = (typeof WORKFLOW_PROFILES)[number];

export function eventTemplateProfile(event: Pick<Event, 'contract_template_profile'>): ContractTemplateProfile {
  const p = event.contract_template_profile?.trim();
  if (p === 'nywe_vendor') return 'nywe_vendor';
  if (p === 'big_smoke') return 'big_smoke';
  return 'whiskyfest';
}

export function eventUsesContractOrderTable(event: Pick<Event, 'contract_template_profile'>): boolean {
  return eventTemplateProfile(event) === 'whiskyfest';
}

export function isEventsManagedWorkflow(event: Pick<Event, 'workflow_profile'>): boolean {
  return event.workflow_profile === 'events_managed';
}

/** NYWE vendor licenses — events team workflow inside the Wine Spectator portal. */
export function isNyweEventsManagedEvent(
  event: Pick<Event, 'product_key' | 'workflow_profile'> | null | undefined,
): boolean {
  return event?.product_key === PRODUCT_WINE_SPECTATOR && isEventsManagedWorkflow(event);
}

/** Big Smoke exhibitor contracts — events-managed workflow. */
export function isBigSmokeEventsManagedEvent(
  event: Pick<Event, 'product_key' | 'workflow_profile'> | null | undefined,
): boolean {
  return event?.product_key === PRODUCT_BIG_SMOKE && isEventsManagedWorkflow(event);
}

export function eventContractDocumentLabel(event: Pick<Event, 'contract_document_label' | 'name'>): string {
  const label = event.contract_document_label?.trim();
  if (label) return label;
  return 'Contract';
}

export function eventProductDisplayName(event: Pick<Event, 'product_key' | 'name'>): string {
  if (event.product_key === 'wine_spectator') return 'Wine Spectator';
  if (event.product_key === 'big_smoke') return 'Big Smoke';
  return 'WhiskyFest';
}
