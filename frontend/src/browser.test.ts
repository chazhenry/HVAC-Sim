import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from './browser';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses crypto.randomUUID when the page is secure', () => {
    expect(newId()).toMatch(UUID_V4);
  });

  it('still makes a valid, unique UUID on plain-http pages without crypto.randomUUID', () => {
    const real = globalThis.crypto;
    // What Safari exposes on http://192.168.x.x: getRandomValues, but no randomUUID.
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect(typeof crypto.randomUUID).toBe('undefined');
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});

describe('isLocalDevHost', () => {
  it('is true on this machine and the 192.168.86.x home network only', async () => {
    const { isLocalDevHost } = await import('./browser');
    for (const host of ['localhost', '127.0.0.1', '[::1]', '192.168.86.226']) expect(isLocalDevHost(host)).toBe(true);
    for (const host of ['hvac.example.com', '192.168.1.20', '10.0.0.5', '192.168.86.226.evil.com']) expect(isLocalDevHost(host)).toBe(false);
  });
});
