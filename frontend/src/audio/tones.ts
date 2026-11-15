/**
 * Short feedback tones synthesised with the Web Audio API, so there are no sound files to load.
 * Each tone is a few notes: frequency (Hz), start and length (s), waveform and loudness.
 */

export type ToneId = 'chime' | 'triad' | 'ding' | 'click' | 'double' | 'descend' | 'buzz' | 'alarm' | 'none';

interface Note { f: number; at: number; len: number; wave: OscillatorType; gain: number; slideTo?: number }

const TONES: Record<Exclude<ToneId, 'none'>, readonly Note[]> = {
  // Success
  chime: [
    { f: 1046.5, at: 0, len: 0.16, wave: 'sine', gain: 0.5 },
    { f: 1318.5, at: 0.09, len: 0.28, wave: 'sine', gain: 0.5 },
  ],
  triad: [
    { f: 523.3, at: 0, len: 0.18, wave: 'triangle', gain: 0.45 },
    { f: 659.3, at: 0.11, len: 0.18, wave: 'triangle', gain: 0.45 },
    { f: 784.0, at: 0.22, len: 0.4, wave: 'triangle', gain: 0.5 },
  ],
  ding: [{ f: 1568, at: 0, len: 0.35, wave: 'triangle', gain: 0.45 }],
  click: [{ f: 2200, at: 0, len: 0.025, wave: 'square', gain: 0.18 }],
  double: [
    { f: 880, at: 0, len: 0.08, wave: 'square', gain: 0.2 },
    { f: 880, at: 0.13, len: 0.08, wave: 'square', gain: 0.2 },
  ],
  // Fail
  descend: [
    { f: 659.3, at: 0, len: 0.16, wave: 'triangle', gain: 0.45 },
    { f: 523.3, at: 0.13, len: 0.3, wave: 'triangle', gain: 0.45 },
  ],
  buzz: [{ f: 150, at: 0, len: 0.28, wave: 'sawtooth', gain: 0.22, slideTo: 120 }],
  alarm: [
    { f: 880, at: 0, len: 0.12, wave: 'square', gain: 0.22 },
    { f: 660, at: 0.14, len: 0.12, wave: 'square', gain: 0.22 },
    { f: 880, at: 0.28, len: 0.12, wave: 'square', gain: 0.22 },
    { f: 660, at: 0.42, len: 0.12, wave: 'square', gain: 0.22 },
  ],
};

export const TONE_NAMES: Record<ToneId, string> = {
  chime: 'Chime (rising)',
  triad: 'Fanfare',
  ding: 'Ding',
  click: 'Click',
  double: 'Double beep',
  descend: 'Falling',
  buzz: 'Buzz',
  alarm: 'Alarm',
  none: 'No sound',
};

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/**
 * Browsers (Safari on iPad above all) start audio suspended until a tap or click. Called on the first
 * pointer press so later tones play straight away.
 */
export function unlockAudio(): void {
  const ctx = audio();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

/** Plays a tone at the given volume (0–1). Silently does nothing where audio is unavailable. */
export function playTone(id: ToneId, volume: number): void {
  if (id === 'none' || volume <= 0) return;
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const start = ctx.currentTime + 0.01;
  for (const note of TONES[id]) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.f, start + note.at);
    if (note.slideTo) osc.frequency.linearRampToValueAtTime(note.slideTo, start + note.at + note.len);
    const peak = note.gain * volume;
    // Quick attack and exponential decay: no clicks at the start or end.
    amp.gain.setValueAtTime(0.0001, start + note.at);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + note.at + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.len);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start + note.at);
    osc.stop(start + note.at + note.len + 0.02);
  }
}
