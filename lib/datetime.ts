/**
 * All user-visible dates/times use a single display timezone so Vercel (UTC) and
 * browsers show consistent "office" time — default US Eastern (WhiskyFest / Shanken).
 *
 * Set NEXT_PUBLIC_DISPLAY_TIMEZONE (e.g. America/Chicago) in .env / Vercel if needed.
 */

export const DISPLAY_TIMEZONE =
  process.env['NEXT_PUBLIC_DISPLAY_TIMEZONE']?.trim() || 'America/New_York';

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function isDateOnlyString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

/**
 * Event `event_date` is stored as YYYY-MM-DD (no time). Parsing with `new Date('2026-11-20')`
 * is UTC midnight and can show as the wrong calendar day in US timezones — avoid that.
 */
export function formatCalendarDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const datePart = iso.trim().split('T')[0] ?? '';
  if (!isDateOnlyString(datePart)) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      timeZone: DISPLAY_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return '—';
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

/**
 * Full timestamps (audit log, cancelled_at, etc.) in the display zone with seconds + zone abbreviation.
 */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    timeZone: DISPLAY_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Long date for emails / lists — date-only strings use calendar parse; instants use display TZ (date part).
 */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const raw = iso.trim();
  const datePart = raw.split('T')[0] ?? '';
  if (isDateOnlyString(datePart)) {
    return formatCalendarDateOnly(datePart);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '—';
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

/** Parts for merge tokens {{agreement_day}}, {{agreement_month}}, {{agreement_year}} — "today" in display TZ (not UTC on the server). */
export function getAgreementDatePartsInDisplayZone(now: Date = new Date()): {
  day: string;
  year: string;
  /** Full month name, e.g. "November" */
  monthName: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(now);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal' && p.value) map[p.type] = p.value;
  }
  return {
    day: map.day ?? '',
    year: map.year ?? '',
    monthName: map.month ?? '',
  };
}

/** Same calendar rules as formatCalendarDateOnly for {{event_date}} in Docs merge. */
export function formatEventDateForMerge(eventDateIso: string): string {
  const s = formatCalendarDateOnly(eventDateIso);
  return s === '—' ? '' : s;
}
