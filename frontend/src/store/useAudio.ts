import { create } from 'zustand';
import { playTone, type ToneId } from '../audio/tones';

/** Moments that get a sound. Each can be given any tone (or none) in Settings > Audio. */
export type CueId = 'clampOn' | 'clampReject' | 'toolMisuse' | 'leadPlaced' | 'hoseOn' | 'unsafe' | 'jobPass' | 'jobFail';

export const CUES: ReadonlyArray<{ id: CueId; label: string; kind: 'success' | 'fail' }> = [
  { id: 'clampOn', label: 'Clamp meter placed on a wire', kind: 'success' },
  { id: 'leadPlaced', label: 'Multimeter lead placed', kind: 'success' },
  { id: 'hoseOn', label: 'Gauge hose connected', kind: 'success' },
  { id: 'jobPass', label: 'Job passed', kind: 'success' },
  { id: 'clampReject', label: 'Clamp on a wire it cannot read', kind: 'fail' },
  { id: 'toolMisuse', label: 'Wrong tool, or nothing to do there', kind: 'fail' },
  { id: 'unsafe', label: 'Unsafe action', kind: 'fail' },
  { id: 'jobFail', label: 'Job failed', kind: 'fail' },
];

export const DEFAULT_TONES: Record<CueId, ToneId> = {
  clampOn: 'chime',
  leadPlaced: 'click',
  hoseOn: 'ding',
  jobPass: 'triad',
  clampReject: 'buzz',
  toolMisuse: 'double',
  unsafe: 'alarm',
  jobFail: 'descend',
};

const STORAGE_KEY = 'hvac-sim.audio';
const TONE_IDS: readonly ToneId[] = ['chime', 'triad', 'ding', 'click', 'double', 'descend', 'buzz', 'alarm', 'none'];

interface AudioSettings { enabled: boolean; volume: number; tones: Record<CueId, ToneId> }

function load(): AudioSettings {
  const fallback: AudioSettings = { enabled: true, volume: 0.6, tones: { ...DEFAULT_TONES } };
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AudioSettings> | null;
    if (!raw) return fallback;
    const tones = { ...DEFAULT_TONES };
    for (const cue of CUES) {
      const tone = raw.tones?.[cue.id];
      if (tone && TONE_IDS.includes(tone)) tones[cue.id] = tone;
    }
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled,
      volume: typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : fallback.volume,
      tones,
    };
  } catch {
    return fallback;
  }
}

interface AudioState extends AudioSettings {
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setTone: (cue: CueId, tone: ToneId) => void;
  resetTones: () => void;
}

export const useAudio = create<AudioState>()((set, get) => {
  const persist = (patch: Partial<AudioSettings>): void => {
    set(patch);
    const { enabled, volume, tones } = get();
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, volume, tones })); } catch { /* This visit only. */ }
  };
  return {
    ...(typeof window === 'undefined' ? { enabled: true, volume: 0.6, tones: { ...DEFAULT_TONES } } : load()),
    setEnabled: (enabled) => persist({ enabled }),
    setVolume: (volume) => persist({ volume: Math.min(1, Math.max(0, volume)) }),
    setTone: (cue, tone) => persist({ tones: { ...get().tones, [cue]: tone } }),
    resetTones: () => persist({ tones: { ...DEFAULT_TONES } }),
  };
});

/** Plays the tone chosen for a moment, if sound is on. Safe to call from anywhere, including the sim store. */
export function playCue(cue: CueId): void {
  const { enabled, volume, tones } = useAudio.getState();
  if (enabled) playTone(tones[cue], volume);
}
