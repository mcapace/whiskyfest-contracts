/**
 * Light success pulse for devices that support the Vibration API (typically mobile).
 */
export function successHaptic(): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate([10, 45, 14]);
  } catch {
    /* ignore */
  }
}
