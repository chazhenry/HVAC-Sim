/**
 * Helpers for browser APIs that only exist on secure pages (https or localhost).
 * On a plain-http LAN address — e.g. testing the dev server from an iPad — they are missing.
 */

/** A random UUID v4; `crypto.randomUUID` needs a secure page, `crypto.getRandomValues` does not. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Copy text; falls back to a hidden textarea where the async clipboard API is unavailable. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) throw new Error('Copy was blocked.');
}

/** The app was opened on this machine or the home network (localhost or 192.168.86.x): development conveniences apply. */
export function isLocalDevHost(hostname = typeof window === 'undefined' ? '' : window.location.hostname): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^192\.168\.86\.\d{1,3}$/.test(host);
}
