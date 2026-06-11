import { isSponsorshipOnlyOrder } from '@/lib/contract-order-type';
import type { Contract, Event } from '@/types/db';

/** WhiskyFest list booth rate when no event context is available. */
export const STANDARD_BOOTH_RATE_CENTS = 1500000;

export function standardBoothRateCentsForEvent(event?: Pick<Event, 'booth_rate_cents'> | null): number {
  return event?.booth_rate_cents ?? STANDARD_BOOTH_RATE_CENTS;
}

// True if the contract is discounted (booth rate below the event list price).
export function isDiscountedRate(boothCents: number, event?: Pick<Event, 'booth_rate_cents'> | null): boolean {
  return boothCents < standardBoothRateCentsForEvent(event);
}

// True if the contract requires discount approval right now.
export function requiresDiscountApproval(
  contract: Pick<Contract, 'booth_rate_cents' | 'discount_approved_at'> & {
    order_type?: Contract['order_type'] | null;
    booth_count?: number;
  },
  event?: Pick<Event, 'booth_rate_cents'> | null,
): boolean {
  if (isSponsorshipOnlyOrder(contract)) return false;
  return isDiscountedRate(contract.booth_rate_cents, event) && !contract.discount_approved_at;
}

export function calculateListSubtotalCents(
  boothCount: number,
  event?: Pick<Event, 'booth_rate_cents'> | null,
): number {
  return boothCount * standardBoothRateCentsForEvent(event);
}

export function calculateDiscountCents(
  boothCount: number,
  actualRateCents: number,
  event?: Pick<Event, 'booth_rate_cents'> | null,
): number {
  const listTotal = boothCount * standardBoothRateCentsForEvent(event);
  const actualTotal = boothCount * actualRateCents;
  return Math.max(0, listTotal - actualTotal);
}
