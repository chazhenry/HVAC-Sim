import { afterEach, describe, expect, it, vi } from 'vitest';
import { OS_DICTATION, dictationPlatform, useDictation } from './useDictation';

const UA = {
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
};

const device = (userAgent: string, maxTouchPoints = 0): void => {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints, language: 'en-US' });
};

describe('dictationPlatform', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tells an iPad (which reports itself as a Mac) from a real Mac by touch support', () => {
    device(UA.ipad, 5);
    expect(dictationPlatform()).toBe('ios');
    device(UA.mac, 0);
    expect(dictationPlatform()).toBe('mac');
  });

  it('recognises Windows and Android', () => {
    device(UA.windows);
    expect(dictationPlatform()).toBe('windows');
    device(UA.android, 5);
    expect(dictationPlatform()).toBe('android');
  });
});

describe('microphone fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useDictation.setState({ hint: null, error: null, listening: false, focusChat: 0 });
  });

  it('points to the OS dictation and focuses the chat box where the browser cannot transcribe', () => {
    // e.g. Firefox, or an iPad on a plain-http LAN address.
    vi.stubGlobal('window', { isSecureContext: false });
    device(UA.windows);
    useDictation.getState().start();
    const state = useDictation.getState();
    expect(state.listening).toBe(false);
    expect(state.hint).toBe(OS_DICTATION.windows);
    expect(state.focusChat).toBe(1);
  });
});
