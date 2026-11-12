import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { type LogEntry, useSim } from '../store/useSim';

export const JOB_LOG_TOAST_CLOSED = 'hvac:job-log-toast-closed';
const CLOSE_MS = 280;

/** Subscribe to every log update so even entries added in one render get a toast. */
export function JobLogToasts(): ReactNode {
  const [queue, setQueue] = useState<LogEntry[]>([]);
  const [closing, setClosing] = useState<{ id: number; x: number; y: number } | null>(null);
  const toast = useRef<HTMLDivElement>(null);
  const entry = queue[0];

  useEffect(() => useSim.subscribe((state, previous) => {
    if (state.sessionId !== previous.sessionId || state.phase === 'menu') {
      setQueue([]);
    }
    if (state.log === previous.log || state.sessionId === null) return;

    const lastId = previous.log.at(-1)?.id ?? -1;
    const added = state.log.filter((item) => item.id > lastId);
    if (added.length > 0) setQueue((pending) => [...pending, ...added]);
  }), []);

  useEffect(() => {
    if (!entry) return;
    // Give longer messages more reading time; new arrivals do not restart the timer.
    const duration = Math.max(3500, Math.min(8000, entry.text.length * 45));
    let closeTimer: number | undefined;
    const timer = window.setTimeout(() => {
      const from = toast.current?.getBoundingClientRect();
      const to = document.getElementById('job-log-tab')?.getBoundingClientRect();
      setClosing({
        id: entry.id,
        x: from && to ? to.left + to.width / 2 - from.left - from.width / 2 : 32,
        y: from && to ? to.top + to.height / 2 - from.top - from.height / 2 : 0,
      });
      closeTimer = window.setTimeout(() => {
        setQueue((pending) => pending.filter((item) => item.id !== entry.id));
        window.dispatchEvent(new Event(JOB_LOG_TOAST_CLOSED));
      }, CLOSE_MS);
    }, duration);
    return () => { window.clearTimeout(timer); window.clearTimeout(closeTimer); };
  }, [entry]);

  const exit = closing?.id === entry?.id ? closing : null;
  return (
    <div className="job-log-toasts" role="status" aria-live="polite" aria-atomic="true">
      {entry && (
        <div ref={toast} key={entry.id} className={`job-log-toast log-${entry.kind}${exit ? ' closing' : ''}`}
          style={exit ? {
            '--toast-exit-x': `${exit.x}px`, '--toast-exit-y': `${exit.y}px`, '--toast-close-ms': `${CLOSE_MS}ms`,
          } as CSSProperties : undefined}>
          {entry.text}
        </div>
      )}
    </div>
  );
}
