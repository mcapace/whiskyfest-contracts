/** Calendar date string (YYYY-MM-DD) in US Eastern — used for bubble `content_date` and dismiss tracking. */
export const BUBBLE_CONTENT_TIMEZONE = 'America/New_York';

export function todayBubbleContentDateString(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUBBLE_CONTENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
