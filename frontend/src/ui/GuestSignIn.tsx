import { type ReactNode, useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '../version';

const GUEST_NAME_KEY = 'hvac-sim.guest-name';

function rememberedName(): string {
  try {
    return (window.localStorage.getItem(GUEST_NAME_KEY) ?? '').trim().slice(0, 100);
  } catch {
    return '';
  }
}

export function GuestSignIn({ onSignIn }: { onSignIn: (name: string) => void }): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(rememberedName);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="dialog guest-signin" aria-labelledby="guest-signin-title"
      aria-describedby="guest-signin-notice" onCancel={(event) => event.preventDefault()}>
      <h1 id="guest-signin-title">HVAC-SIM <span className="app-version">(v{APP_VERSION})</span></h1>
      <h2>Invited guest sign-in</h2>
      <p id="guest-signin-notice">HVAC-SIM is a private demo for invited guests. It is not for public viewing and not to used for HVAC guidance.</p>
      <form className="guest-signin-form" onSubmit={(event) => {
        event.preventDefault();
        const user = name.trim();
        if (!user) return;
        try { window.localStorage.setItem(GUEST_NAME_KEY, user); } catch { /* Continue if storage is unavailable. */ }
        onSignIn(user);
      }}>
        <label htmlFor="guest-name">Enter your name if invited</label>
        <input id="guest-name" name="name" autoComplete="name" autoFocus required maxLength={100}
          value={name} onChange={(event) => setName(event.target.value)} />
        <button type="submit" className="primary" disabled={!name.trim()}>Sign in</button>
      </form>
    </dialog>
  );
}
