import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { DISPLAY_TIMEZONE, formatTimestamp } from '@/lib/datetime';

/** Prefer session activity; fall back to OAuth sign-in time for older rows. */
export function lastActiveIso(user: {
  last_seen_at?: string | null;
  last_login_at?: string | null;
}): string | null {
  const s = user.last_seen_at?.trim();
  if (s) return s;
  const l = user.last_login_at?.trim();
  return l || null;
}

/** Tooltip: full instant in display timezone (e.g. "Apr 24, 2026, 10:45:23 AM EDT"). */
export function lastLoginFullTooltip(iso: string | null | undefined): string {
  if (!iso) return 'Never signed in';
  return formatTimestamp(iso);
}

/** Tooltip for the combined "last active" column. */
export function lastActiveFullTooltip(iso: string | null | undefined): string {
  if (!iso) return 'No recorded activity';
  return formatTimestamp(iso);
}

/**
 * Relative / bucketed label for the Users admin "Last Login" column.
 * Uses the viewer's current time (`now`) — intended for client render.
 */
export function formatLastLoginRelative(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return 'Never';
  const past = new Date(iso);
  if (Number.isNaN(past.getTime())) return 'Never';

  const sec = differenceInSeconds(now, past);
  if (sec < 60) return 'Just now';

  const min = differenceInMinutes(now, past);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;

  const hrs = differenceInHours(now, past);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;

  const days = differenceInDays(now, past);
  if (days < 2) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  if (days < 84) {
    const w = Math.floor(days / 7);
    const weeks = Math.max(1, Math.min(w, 12));
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  return past.toLocaleDateString('en-US', {
    timeZone: DISPLAY_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
