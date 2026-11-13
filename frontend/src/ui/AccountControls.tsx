import { type ReactNode, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../store/useAuth';

export function AccountControls({ compact = false }: { compact?: boolean }): ReactNode {
  const user = useAuth((state) => state.user);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return <div className={`auth-account${compact ? ' compact' : ''}`}><span title={user.email}>{user.fname} {user.lname} · {user.email}</span>
    <button type="button" className="ghost" title={`Sign out ${user.email}`} disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api.logout(); } catch { /* Discard the in-memory session even if offline. */ }
      finally { useAuth.getState().clearSession(); setBusy(false); }
    }}>{busy ? 'Signing out…' : 'Sign out'}</button>
  </div>;
}
