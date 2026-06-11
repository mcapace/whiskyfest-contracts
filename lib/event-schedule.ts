import { DISPLAY_TIMEZONE, formatCalendarDateOnly } from '@/lib/datetime';
import type { Event } from '@/types/db';

type EventScheduleFields = Pick<Event, 'event_date' | 'event_end_date' | 'event_start_time' | 'venue'>;

function parseDateParts(iso: string): { year: number; month: number; day: number } | null {
  const datePart = iso.trim().split('T')[0] ?? '';
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** October 22–24, 2026 (or single day when no end date). */
export function formatEventDateRange(event: Pick<Event, 'event_date' | 'event_end_date'>): string {
  const start = formatCalendarDateOnly(event.event_date);
  if (start === '—') return '—';
  const endIso = event.event_end_date?.trim();
  if (!endIso || endIso === event.event_date) return start;

  const startParts = parseDateParts(event.event_date);
  const endParts = parseDateParts(endIso);
  if (!startParts || !endParts) {
    return `${start} – ${formatCalendarDateOnly(endIso)}`;
  }

  if (startParts.year === endParts.year && startParts.month === endParts.month) {
    const monthName = new Date(startParts.year, startParts.month - 1, startParts.day).toLocaleDateString('en-US', {
      month: 'long',
    });
    return `${monthName} ${startParts.day}–${endParts.day}, ${startParts.year}`;
  }

  return `${start} – ${formatCalendarDateOnly(endIso)}`;
}

export function venueDisplayName(venue: string | null | undefined): string {
  const v = venue?.trim();
  if (!v) return 'Marriott Marquis';
  return v.split(',')[0]?.trim() || v;
}

/** Hero / dashboard line: dates · start time · venue. */
export function formatEventScheduleLine(event: EventScheduleFields): string {
  const parts = [formatEventDateRange(event)];
  const startTime = event.event_start_time?.trim();
  if (startTime) parts.push(`Beginning at ${startTime}`);
  parts.push(venueDisplayName(event.venue));
  return parts.join(' · ');
}

/** Same as merge output when event spans multiple days. */
export function formatEventDateForDisplayOrMerge(event: Pick<Event, 'event_date' | 'event_end_date'>): string {
  return formatEventDateRange(event);
}

/** ISO instant for countdown — first day + start time in display timezone. */
export function eventCountdownTargetIso(event: EventScheduleFields): string | undefined {
  const datePart = event.event_date?.trim().split('T')[0];
  const timeLabel = event.event_start_time?.trim();
  if (!datePart || !timeLabel) return undefined;

  const match = timeLabel.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  const [, month] = datePart.split('-').map(Number);
  if (!month) return undefined;

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  // US Eastern: EDT through late October, EST afterward.
  const offset = month >= 3 && month <= 10 ? '-04:00' : '-05:00';
  return `${datePart}T${hh}:${mm}:00${offset}`;
}
