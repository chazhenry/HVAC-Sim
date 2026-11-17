import { type ReactNode, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { passwordRequirements } from "../auth/password";
import { rememberedEmail, rememberEmail } from "../store/guest";
import { useAuth } from "../store/useAuth";
import { APP_VERSION } from "../version";
import previewImage from "../assets/signin-preview.png";

export function SignIn(): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState(rememberedEmail);
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requirements = passwordRequirements(password);
  const matches = password === confirmation;
  // On sign-up, the typed characters turn green once valid and stay red until then.
  const validity = (ok: boolean) =>
    register ? (ok ? "password-valid" : "password-invalid") : undefined;
  const eye = (
    <button
      type="button"
      className="password-toggle"
      aria-label={show ? "Hide passwords" : "Show passwords"}
      title={show ? "Hide passwords" : "Show passwords"}
      aria-pressed={show}
      disabled={busy}
      onClick={() => setShow((value) => !value)}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
        {show && <line x1="3" y1="3" x2="21" y2="21" />}
      </svg>
    </button>
  );
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="dialog guest-signin"
      aria-labelledby="guest-signin-title"
      aria-describedby="guest-signin-notice"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="guest-signin-intro">
        <div className="guest-signin-heading">
          <h1 id="guest-signin-title">
            HVAC-SIM <span className="app-version">(v{APP_VERSION})</span>
          </h1>
          <h2>Login / Register</h2>
          <p id="guest-signin-notice">
            HVAC-SIM is a private demo for invited guests. It is not for public
            viewing and not certified for HVAC production use.
          </p>
        </div>
        <img
          className="guest-signin-preview"
          src={previewImage}
          width={1197}
          height={702}
          alt="HVAC-Sim: a 3D outdoor condensing unit with its control box open, the air handler behind it, and the tool bag of meters and gauges on the left."
        />
      </div>
      <form
        className="guest-signin-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          if (register && !matches) {
            setError("Passwords do not match.");
            return;
          }
          setBusy(true);
          setError(null);
          rememberEmail(email);
          try {
            const result = register
              ? await api.register(email, fname, lname, password, confirmation)
              : await api.login(email, password);
            setPassword("");
            setConfirmation("");
            useAuth.getState().setSession(result);
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : "Could not sign in.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <div className="auth-name-fields">
            <label>
              First name
              <input
                name="given-name"
                autoComplete="given-name"
                required
                maxLength={100}
                value={fname}
                disabled={busy}
                onChange={(event) => setFname(event.target.value)}
              />
            </label>
            <label>
              Last name
              <input
                name="family-name"
                autoComplete="family-name"
                required
                maxLength={100}
                value={lname}
                disabled={busy}
                onChange={(event) => setLname(event.target.value)}
              />
            </label>
          </div>
        )}
        <div className={`auth-name-fields${register ? " three" : ""}`}>
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            required
            maxLength={254}
            value={email}
            disabled={busy}
            onBlur={() => rememberEmail(email)}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <span className="password-field">
            <input
              className={validity(requirements.every((item) => item.met))}
              type={show ? "text" : "password"}
              name="password"
              autoComplete={register ? "new-password" : "current-password"}
              // Signing in may leave it blank: the server accepts that only on localhost / the home network.
              required={register}
              minLength={register ? 8 : undefined}
              maxLength={128}
              value={password}
              disabled={busy}
              aria-describedby={register ? "password-rules" : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {eye}
          </span>
        </label>
        {register && (
          <label>
            Confirm password
            <span className="password-field">
              <input
                className={validity(confirmation.length > 0 && matches)}
                type={show ? "text" : "password"}
                name="confirm-password"
                autoComplete="new-password"
                required
                maxLength={128}
                value={confirmation}
                disabled={busy}
                aria-invalid={confirmation.length > 0 && !matches}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              {eye}
            </span>
          </label>
        )}
        </div>
        {register && (
          <>
            <ul className="password-rules" id="password-rules">
              {requirements
                .filter((item) => item.display !== false)
                .map((item) => (
                  <li key={item.label} className={item.met ? "met" : ""}>
                    <span aria-hidden="true">{item.met ? "✓" : "○"}</span>{" "}
                    {item.label}
                  </li>
                ))}
            </ul>
            {confirmation && !matches && (
              <p className="error" role="status">
                Passwords do not match.
              </p>
            )}
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="primary"
          disabled={
            busy ||
            (register && (!requirements.every((item) => item.met) || !matches))
          }
        >
          {busy
            ? "Please wait…"
            : register
              ? "Create account and sign in"
              : "Sign in"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={() => {
            setRegister((value) => !value);
            setError(null);
            setPassword("");
            setConfirmation("");
            setShow(false);
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </form>
    </dialog>
  );
}
