import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cents as US dollars: 1500000 → "$15,000"
 */
export function formatCurrency(cents: number | null | undefined, opts?: { showCents?: boolean }): string {
  if (cents == null) return '—';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts?.showCents ? 2 : 0,
    maximumFractionDigits: opts?.showCents ? 2 : 0,
  }).format(dollars);
}

export {
  DISPLAY_TIMEZONE,
  formatCalendarDateOnly,
  formatEventDateForMerge,
  formatLongDate,
  formatRelative,
  formatTimestamp,
  getAgreementDatePartsInDisplayZone,
} from './datetime';
