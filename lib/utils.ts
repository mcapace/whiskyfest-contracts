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

/**
 * Format an ISO date as "November 20, 2026"
 */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format timestamp as "Apr 20, 2026 at 2:14 PM"
 */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Relative time — "2 hours ago", "3 days ago"
 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatLongDate(iso);
}
