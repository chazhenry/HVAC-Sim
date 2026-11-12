const GUEST_NAME_KEY = 'hvac-sim.guest-name';
let currentName = '';

export function rememberedGuestName(): string {
  if (currentName) return currentName;
  try { return (window.localStorage.getItem(GUEST_NAME_KEY) ?? '').trim().slice(0, 100); }
  catch { return ''; }
}

export function rememberGuestName(name: string): void {
  currentName = name.trim();
  try { window.localStorage.setItem(GUEST_NAME_KEY, currentName); } catch { /* Keep this visit's name in memory. */ }
}
