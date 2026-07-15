import type { ContractOrderType } from '@/lib/contract-order-type';
import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import {
  packageSelectionsFromContract,
  pricingFromBigSmokeInput,
} from '@/lib/big-smoke-pricing';

/** Rep-facing deal shape on the dashboard and order form. */
export const CONTRACT_DEAL_KINDS = ['booth', 'sponsorship_only', 'booth_and_sponsorship'] as const;

export type ContractDealKind = (typeof CONTRACT_DEAL_KINDS)[number];

export type DealKindMeta = {
  kind: ContractDealKind;
  title: string;
  description: string;
  href: string;
};

export const DEAL_KIND_META: Record<ContractDealKind, Omit<DealKindMeta, 'kind'>> = {
  booth: {
    title: 'Booth deal',
    description: 'Exhibitor booth package only — standard booth pricing on the contract.',
    href: '/contracts/new?deal=booth',
  },
  sponsorship_only: {
    title: 'Sponsorship only',
    description: 'Program or media sponsorship with no booth — charges are line items only.',
    href: '/contracts/new?deal=sponsorship_only',
  },
  booth_and_sponsorship: {
    title: 'Booth + sponsorship',
    description: 'Booth package plus added sponsorships or activations (e.g. Oliva-style combo deals).',
    href: '/contracts/new?deal=booth_and_sponsorship',
  },
};

export function dealKindMeta(kind: ContractDealKind): DealKindMeta {
  return { kind, ...DEAL_KIND_META[kind] };
}

export function parseDealKindParam(raw: string | null | undefined): ContractDealKind | null {
  const v = raw?.trim();
  if (v && CONTRACT_DEAL_KINDS.includes(v as ContractDealKind)) {
    return v as ContractDealKind;
  }
  return null;
}

export function orderTypeFromDealKind(kind: ContractDealKind): ContractOrderType {
  return kind === 'sponsorship_only' ? 'sponsorship_only' : 'booth';
}

export function dealKindFromContract(contract: {
  order_type?: string | null;
  booth_count?: number | null;
  line_items_subtotal_cents?: number | null;
}): ContractDealKind {
  if (isSponsorshipOnlyOrder(contract)) return 'sponsorship_only';
  if ((contract.line_items_subtotal_cents ?? 0) > 0) return 'booth_and_sponsorship';
  return 'booth';
}

export function dealKindLabel(kind: ContractDealKind): string {
  return DEAL_KIND_META[kind].title;
}

/** Compact label for contracts list / cards (replaces raw booth count). */
export function listPackageLabel(contract: {
  order_type?: string | null;
  booth_count?: number | null;
  line_items_subtotal_cents?: number | null;
  package_key?: string | null;
  package_selections?: { key: string; qty: number }[] | null;
}): string {
  const priced = pricingFromBigSmokeInput({
    package_selections: packageSelectionsFromContract(contract),
    package_key: contract.package_key,
  });
  if (priced) {
    const booths = priced.booth_count;
    if (priced.package_selections.length > 1 || priced.package_selections.some((s) => s.qty > 1)) {
      return `${priced.displayName} · ${booths} booth${booths === 1 ? '' : 's'}`;
    }
    return priced.displayName;
  }

  const kind = dealKindFromContract(contract);
  if (kind === 'sponsorship_only') return 'Sponsorship only';
  const n = contract.booth_count ?? 1;
  const boothLabel = `${n} booth${n === 1 ? '' : 's'}`;
  if (kind === 'booth_and_sponsorship') return `${boothLabel} + sponsorship`;
  return boothLabel;
}
