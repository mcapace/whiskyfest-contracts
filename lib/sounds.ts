function playWebAudioChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    master.connect(ctx.destination);
    [523.25, 659.25].forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, now + i * 0.055);
      o.connect(master);
      o.start(now + i * 0.055);
      o.stop(now + 0.26);
    });
    void ctx.resume().catch(() => {});
    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* ignore */
  }
}

/**
 * Short success tone. Tries `/public/sounds/success.mp3` when present; falls back to a soft synthesized chime.
 */
export function playSuccessSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const a = new Audio('/sounds/success.mp3');
    a.volume = 0.32;
    void a.play().catch(() => {
      playWebAudioChime();
    });
  } catch {
    playWebAudioChime();
  }
}
