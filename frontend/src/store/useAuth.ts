import { create } from 'zustand';
import type { AuthResponse, AuthUser } from '../api/types';
import { rememberEmail, rememberGuestName } from './guest';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  expiresAt: number;
  setSession: (session: AuthResponse) => void;
  clearSession: () => void;
}

/** Only the email is remembered on disk. Passwords and bearer sessions are never persisted. */
export const useAuth = create<AuthState>((set) => ({
  user: null, token: null, expiresAt: 0,
  setSession: ({ user, token, expiresAt }) => {
    rememberEmail(user.email);
    // Existing feedback/progress consumers now identify accounts by email.
    rememberGuestName(user.email);
    set({ user, token, expiresAt });
  },
  clearSession: () => {
    rememberGuestName('');
    set({ user: null, token: null, expiresAt: 0 });
  },
}));
