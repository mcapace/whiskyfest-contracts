import type { Contract } from '@/types/db';

export const STANDARD_BOOTH_RATE_CENTS = 1500000;

// True if the contract is discounted (booth rate below $15,000).
export function isDiscountedRate(boothCents: number): boolean {
  return boothCents < STANDARD_BOOTH_RATE_CENTS;
}

// True if the contract requires discount approval right now.
export function requiresDiscountApproval(contract: Pick<Contract, 'booth_rate_cents' | 'discount_approved_at'>): boolean {
  return isDiscountedRate(contract.booth_rate_cents) && !contract.discount_approved_at;
}

export function calculateListSubtotalCents(boothCount: number): number {
  return boothCount * STANDARD_BOOTH_RATE_CENTS;
}

export function calculateDiscountCents(boothCount: number, actualRateCents: number): number {
  const listTotal = boothCount * STANDARD_BOOTH_RATE_CENTS;
  const actualTotal = boothCount * actualRateCents;
  return Math.max(0, listTotal - actualTotal);
}
