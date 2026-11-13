import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import type { AuthResponse } from '../api/types';
import { rememberEmail, rememberedEmail, rememberedGuestName } from '../store/guest';
import { useAuth } from '../store/useAuth';
import { SignIn } from '../ui/SignIn';
import { passwordRequirements } from './password';

const session: AuthResponse = { user: { id: 1, email: 'ada@example.com', fname: 'Ada', lname: 'Trainer', ipaddress: '127.0.0.1', loginCount: 1 },
  token: 'opaque-session-token-not-for-storage', expiresAt: Date.now() / 1000 + 43200 };
let saved: Map<string, string>;
beforeEach(() => {
  vi.restoreAllMocks();
  saved = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });
  vi.stubGlobal('fetch', vi.fn());
  rememberEmail(''); useAuth.getState().clearSession();
});

describe('email and password sign-in', () => {
  it('stores only the email and prefills it after sign-out without prefilling a password', () => {
    useAuth.getState().setSession(session);
    expect(rememberedGuestName()).toBe('ada@example.com');
    expect(useAuth.getState().token).toBe(session.token);
    expect(JSON.stringify([...saved])).not.toContain(session.token);
    useAuth.getState().clearSession();
    expect(rememberedEmail()).toBe('ada@example.com');
    const html = renderToStaticMarkup(<SignIn />);
    expect(html).toContain('value="ada@example.com"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('name="password"');
    expect(html).not.toContain(session.token);
  });
  it('sends credentials and confirmation to registration, and the bearer token to protected requests', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 201 }));
    const result = await api.register('ada@example.com', 'Ada', 'Trainer', 'LearningHVAC!26', 'LearningHVAC!26');
    expect(result.user.email).toBe(session.user.email);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string)).toMatchObject({ password: 'LearningHVAC!26', confirmPassword: 'LearningHVAC!26' });
    useAuth.getState().setSession(result);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(session.user)));
    expect(await api.currentUser()).toEqual(session.user);
    expect(vi.mocked(fetch).mock.calls[1]![1]!.headers).toMatchObject({ Authorization: `Bearer ${session.token}` });
    expect(JSON.stringify([...saved])).not.toContain('LearningHVAC!26');
  });
  it('clears an expired server session while retaining the email hint', async () => {
    useAuth.getState().setSession(session);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Please sign in to continue.' }), { status: 401 }));
    await expect(api.currentUser()).rejects.toThrow('Please sign in');
    expect(useAuth.getState().user).toBeNull(); expect(useAuth.getState().token).toBeNull();
    expect(rememberedEmail()).toBe(session.user.email);
  });
  it('handles the empty logout response and unavailable local storage', async () => {
    vi.stubGlobal('window', { get localStorage() { throw new Error('Blocked'); } });
    useAuth.getState().setSession(session);
    expect(rememberedEmail()).toBe(session.user.email);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(api.logout()).resolves.toBeUndefined();
    useAuth.getState().clearSession();
    expect(useAuth.getState().token).toBeNull();
  });
  it('matches the server password policy including confirmation-ready strength checks', () => {
    expect(passwordRequirements('LearningHVAC!26').every((rule) => rule.met)).toBe(true);
    for (const password of ['Short1!', 'alllowercase26!', 'ALLUPPERCASE26!', 'NoNumbersHere!', 'NoSymbolsHere26', 'LearningHVAC!26\n', 'Aa1!' + 'x'.repeat(129)]) {
      expect(passwordRequirements(password).every((rule) => rule.met)).toBe(false);
    }
  });
});
