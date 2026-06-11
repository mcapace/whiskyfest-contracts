export const CONTRACT_ORDER_TYPES = ['booth', 'sponsorship_only'] as const;

export type ContractOrderType = (typeof CONTRACT_ORDER_TYPES)[number];

export function isSponsorshipOnlyOrder(contract: {
  order_type?: string | null;
  booth_count?: number | null;
}): boolean {
  return contract.order_type === 'sponsorship_only' || (contract.booth_count ?? 1) === 0;
}
