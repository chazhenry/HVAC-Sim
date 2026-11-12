import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { VisitsPage } from '../api/types';

const PAGE_SIZE = 50;

function VisitsDialog({ onClose, onDenied }: { onClose: () => void; onDenied: () => void }): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState({ search: '', offset: 0 });
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState<VisitsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setPage(null);
    void api.visits(query.search, query.offset, PAGE_SIZE, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setPage(result); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 403) {
          onDenied();
          return;
        }
        setError(reason instanceof Error ? reason.message : 'Could not load visits.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, refresh, onDenied]);

  return (
    <dialog ref={dialog} className="dialog visits-dialog" aria-labelledby="visits-title" onCancel={onClose}>
      <header className="visits-heading">
        <h2 id="visits-title">Visits log</h2>
        <button type="button" onClick={onClose} aria-label="Close visits log">Close ×</button>
      </header>
      <form className="visits-toolbar" onSubmit={(event) => {
        event.preventDefault();
        setQuery({ search: draft.trim(), offset: 0 });
      }}>
        <input autoFocus aria-label="Search visits" placeholder="Search user, IP, city, state, country, date, version or event"
          maxLength={200} value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit">Search</button>
        <button type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>Refresh</button>
      </form>
      <div role="status" aria-live="polite">
        {loading ? 'Loading visits…' : error ? '' : `${page?.total ?? 0} matching visits · newest first`}
      </div>
      {error && <div className="error" role="alert">{error} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></div>}
      <div className="visits-table-scroll" aria-busy={loading} tabIndex={0} aria-label="Visit records">
        <table className="visits-table">
          <thead><tr>
            <th scope="col">Time (your timezone)</th><th scope="col">User</th><th scope="col">Event</th><th scope="col">IP</th><th scope="col">City</th>
            <th scope="col">State / region</th><th scope="col">Country</th><th scope="col">App version</th>
          </tr></thead>
          <tbody>
            {page?.items.map((visit) => <tr key={visit.id}>
              <td><time dateTime={visit.visitedAt}>{new Date(visit.visitedAt).toLocaleString()}</time></td>
              <td>{visit.user ?? '—'}</td><td>{visit.event}</td><td>{visit.ip}</td><td>{visit.city ?? '—'}</td><td>{visit.state ?? '—'}</td>
              <td>{visit.country ?? '—'}</td><td>{visit.appVersion}</td>
            </tr>)}
            {!loading && !error && page?.items.length === 0 && <tr><td colSpan={8}>No visits found.</td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="visits-pagination">
        <button type="button" disabled={loading || query.offset === 0} onClick={() => setQuery((value) => ({
          ...value, offset: Math.max(0, value.offset - PAGE_SIZE),
        }))}>Previous</button>
        <span>{page && page.items.length > 0 ? `${page.offset + 1}–${page.offset + page.items.length} of ${page.total}` : '—'}</span>
        <button type="button" disabled={loading || !page || page.offset + page.limit >= page.total} onClick={() => setQuery((value) => ({
          ...value, offset: value.offset + PAGE_SIZE,
        }))}>Next</button>
      </footer>
    </dialog>
  );
}

/** The backend decides visibility and independently enforces access to the log. */
export function VisitsAdmin(): ReactNode {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const check = (): void => {
      void api.visitsAccess().then((result) => {
        if (!active) return;
        setAllowed(result.allowed);
        if (!result.allowed) setOpen(false);
      }).catch(() => {
        if (active) { setAllowed(false); setOpen(false); }
      });
    };
    check();
    window.addEventListener('focus', check);
    return () => { active = false; window.removeEventListener('focus', check); };
  }, []);

  // Keep this callback stable so modal requests do not restart on parent renders.
  const onDenied = useCallback(() => { setAllowed(false); setOpen(false); }, []);
  if (!allowed) return null;
  return <>
    <button type="button" className="visits-admin-button" aria-label="Browse visits log" title="Visits log"
      aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="m9 3-.5 2-1.7 1-2-.6-2 3.4 1.5 1.4v2l-1.5 1.4 2 3.4 2-.6 1.7 1 .5 2h4l.5-2 1.7-1 2 .6 2-3.4-1.5-1.4v-2l1.5-1.4-2-3.4-2 .6-1.7-1L13 3Z" />
        <circle cx="11" cy="11.5" r="3" />
      </svg>
    </button>
    {open && <VisitsDialog onClose={() => setOpen(false)} onDenied={onDenied} />}
  </>;
}
