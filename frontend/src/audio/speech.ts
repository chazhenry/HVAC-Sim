/**
 * Text-to-speech for the Speak tool, using the browser's built-in speech synthesis: the operating
 * system's own voices (Windows, macOS, iPadOS), so there is no server, no cost and it works offline
 * where those voices are installed.
 */

export const speechSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Part labels are written for reading ("Contactor L1 (line)", "Wire: L2 · line"); make them sound natural. */
export function spokenText(label: string): string {
  return label
    .replace(/^Wire:\s*/i, 'Wire, ')
    .replace(/\s+[-–—·]\s+/g, ', ')
    .replace(/[()]/g, ' ')
    .replace(/\bL1\b/g, 'L 1')
    .replace(/\bL2\b/g, 'L 2')
    .replace(/\bT1\b/g, 'T 1')
    .replace(/\bT2\b/g, 'T 2')
    .replace(/\bR-?410A\b/gi, 'R 4 10 A')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const VOICE_KEY = 'hvac-sim.voice';

/** Names that mark the newer, natural-sounding voices (Edge "Natural", Chrome "Google", Apple "Enhanced"). */
const NATURAL = /natural|online|neural|google|premium|enhanced|siri/i;

/** Ranks a voice: natural voices first, then the page's own language, then other English. */
function rank(v: SpeechSynthesisVoice, lang: string): number {
  return (NATURAL.test(v.name) ? 0 : 4) + (v.lang.toLowerCase() === lang ? 0 : 2) + (v.default ? 0 : 1);
}

/** The English voices this browser offers, best first. Empty until the browser has loaded them. */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  const lang = (navigator.language || 'en-US').toLowerCase();
  return window.speechSynthesis.getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => rank(a, lang) - rank(b, lang) || a.name.localeCompare(b.name));
}

/** The voice name picked in Settings > Audio, or null for automatic. */
export function savedVoiceName(): string | null {
  try {
    return window.localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

let picked: string | null = savedVoiceName();

/** Picks the Speak tool's voice by name; null goes back to automatic (the best voice available). */
export function setVoiceName(name: string | null): void {
  picked = name;
  try {
    if (name) window.localStorage.setItem(VOICE_KEY, name);
    else window.localStorage.removeItem(VOICE_KEY);
  } catch {
    // Storage can be blocked; the choice then lasts for this visit only.
  }
}

/** The picked voice if this browser has it, otherwise the best English voice. */
function voice(): SpeechSynthesisVoice | null {
  const voices = englishVoices();
  return voices.find((v) => v.name === picked) ?? voices[0] ?? null;
}

/** Speaks a part's name, interrupting anything still being spoken. Returns false where speech is unavailable. */
export function speakName(label: string, volume = 1): boolean {
  if (!speechSupported()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(spokenText(label));
  const chosen = voice();
  if (chosen) utterance.voice = chosen;
  utterance.rate = 1;
  utterance.volume = Math.max(0.1, Math.min(1, volume));
  synth.speak(utterance);
  return true;
}
