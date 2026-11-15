import { create } from 'zustand';

/**
 * Voice input for the tutor chat, using the browser's speech recognition (Safari and Chrome).
 * Speech is turned into text in the chat box for the learner to check and send; nothing is sent
 * automatically. Browsers only allow the microphone on https or localhost pages.
 */

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const dictationSupported = (): boolean => typeof window !== 'undefined' && recognitionClass() !== null;

/** The browser can transcribe here itself (it also needs an https or localhost page for the microphone). */
export const browserCanTranscribe = (): boolean => dictationSupported() && window.isSecureContext;

export type DictationPlatform = 'ios' | 'mac' | 'windows' | 'android' | 'chromeos' | 'other';

export function dictationPlatform(): DictationPlatform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; touch support tells them apart.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Windows/.test(ua)) return 'windows';
  return 'other';
}

/** The operating system's own dictation, which types into whatever text box has focus. */
export const OS_DICTATION: Record<DictationPlatform, string> = {
  ios: 'Tap the chat box, then the microphone key on the keyboard to dictate.',
  android: 'Tap the chat box, then the microphone on the keyboard to dictate.',
  mac: 'Press the Fn (globe) key twice to dictate into the chat box. Turn Dictation on in System Settings > Keyboard if needed.',
  windows: 'Press Windows + H to dictate into the chat box.',
  chromeos: 'Press Search + D to dictate into the chat box. Turn Dictation on in Settings > Accessibility if needed.',
  other: 'Voice input is not available in this browser. Try Chrome, Edge or Safari, or type your question.',
};

interface DictationState {
  listening: boolean;
  /** Words heard so far that may still change. */
  interim: string;
  error: string | null;
  /** How to dictate with the operating system instead, when the browser cannot transcribe. */
  hint: string | null;
  /** Finished text for the chat box; n makes repeated phrases distinct. */
  heard: { text: string; n: number };
  /** Bumped to ask the chat box to take focus, so the OS's own dictation types into it. */
  focusChat: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it for this site in the browser settings.',
  'service-not-allowed': 'Voice input needs a secure (https) page.',
  'no-speech': 'No speech heard. Tap the microphone and try again.',
  'audio-capture': 'No microphone was found.',
  network: 'Voice input needs an internet connection.',
};

let active: Recognition | null = null;

export const useDictation = create<DictationState>()((set, get) => ({
  listening: false,
  interim: '',
  error: null,
  hint: null,
  heard: { text: '', n: 0 },
  focusChat: 0,
  start: () => {
    const Recognition = recognitionClass();
    if (!Recognition || !window.isSecureContext) {
      // Fall back to the operating system's dictation, typing straight into the focused chat box.
      set((state) => ({ hint: OS_DICTATION[dictationPlatform()], error: null, focusChat: state.focusChat + 1 }));
      return;
    }
    if (active) return;
    const recognition = new Recognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final.trim()) set((state) => ({ heard: { text: final.trim(), n: state.heard.n + 1 }, interim: '' }));
      else set({ interim });
    };
    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      const blocked = ['not-allowed', 'service-not-allowed', 'network'].includes(event.error);
      set((state) => ({
        error: ERRORS[event.error] ?? 'Voice input stopped unexpectedly.',
        // Where the browser's recognition is unavailable, the OS dictation still works.
        ...(blocked ? { hint: OS_DICTATION[dictationPlatform()], focusChat: state.focusChat + 1 } : {}),
      }));
    };
    recognition.onend = () => { active = null; set({ listening: false, interim: '' }); };
    active = recognition;
    set({ listening: true, interim: '', error: null, hint: null });
    try { recognition.start(); } catch { active = null; set({ listening: false, error: 'Voice input could not start.' }); }
  },
  stop: () => { active?.stop(); },
  toggle: () => (get().listening ? get().stop() : get().start()),
}));
