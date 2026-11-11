import { type ReactNode, useEffect, useState } from 'react';
import { type LogEntry, useSim } from '../store/useSim';

/** Subscribe to every log update so even entries added in one render get a toast. */
export function JobLogToasts(): ReactNode {
  const [queue, setQueue] = useState<LogEntry[]>([]);
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
    const timer = window.setTimeout(() => {
      setQueue((pending) => pending.filter((item) => item.id !== entry.id));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [entry]);

  return (
    <div className="job-log-toasts" role="status" aria-live="polite" aria-atomic="true">
      {entry && (
        <div key={entry.id} className={`job-log-toast log-${entry.kind}`}>
          {entry.text}
        </div>
      )}
    </div>
  );
}
