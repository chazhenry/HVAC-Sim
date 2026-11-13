const GUEST_NAME_KEY = 'hvac-sim.guest-name';
const EMAIL_KEY = 'hvac-sim.email';
let currentName = '';
let currentEmail = '';

export function rememberedEmail(): string {
  if (currentEmail) return currentEmail;
  try { return (window.localStorage.getItem(EMAIL_KEY) ?? '').trim().slice(0, 254); }
  catch { return ''; }
}

export function rememberEmail(email: string): void {
  currentEmail = email.trim().toLowerCase();
  try { window.localStorage.setItem(EMAIL_KEY, currentEmail); } catch { /* Keep the email for this visit. */ }
}

export function rememberedGuestName(): string {
  if (currentName) return currentName;
  try { return (window.localStorage.getItem(GUEST_NAME_KEY) ?? '').trim().slice(0, 254); }
  catch { return ''; }
}

export function rememberGuestName(name: string): void {
  currentName = name.trim();
  try { window.localStorage.setItem(GUEST_NAME_KEY, currentName); } catch { /* Keep this visit's name in memory. */ }
}
