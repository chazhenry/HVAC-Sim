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

let english: SpeechSynthesisVoice | null | undefined;

/** A voice in the page's language (falling back to any English voice), chosen once the voices load. */
function voice(): SpeechSynthesisVoice | null {
  if (english !== undefined) return english;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const lang = (navigator.language || 'en-US').toLowerCase();
  english = voices.find((v) => v.lang.toLowerCase() === lang && v.localService)
    ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)))
    ?? voices.find((v) => v.lang.toLowerCase().startsWith('en'))
    ?? null;
  return english;
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
