import { successHaptic } from '@/lib/haptic';
import { playSuccessSound } from '@/lib/sounds';

/** Sound + haptic when the user has enabled `sound_enabled` on their profile. */
export function emitContractActionSuccessFeedback(soundEnabled: boolean): void {
  if (!soundEnabled) return;
  playSuccessSound();
  successHaptic();
}
