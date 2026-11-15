import { api } from '../api/client';
import { newId } from '../browser';
import { APP_VERSION } from '../version';
import { useAuth } from './useAuth';

/** One 'home' row per sign-in: noted 'login' at once, then relabelled with the mode and equipment first chosen. */
let signIn: { token: string; visitId: string; chosen: boolean } | null = null;

export function logSignIn(): void {
  const { token, user } = useAuth.getState();
  if (!token || !user || signIn?.token === token) return;
  signIn = { token, visitId: newId(), chosen: false };
  void api.trackVisit(signIn.visitId, APP_VERSION, 'home', user.email, 'login').catch(() => undefined);
}

/** e.g. "Residential troubleshooting / Generic-ac". Only the first choice after signing in is recorded. */
export function logSignInChoice(note: string): void {
  const { token, user } = useAuth.getState();
  if (!token || !user || !signIn || signIn.token !== token || signIn.chosen) return;
  signIn.chosen = true;
  void api.trackVisit(signIn.visitId, APP_VERSION, 'home', user.email, note).catch(() => undefined);
}
