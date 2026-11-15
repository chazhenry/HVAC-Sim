import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { activeClick } from '../store/clickScope';
import { type LogEntry, type LogKind, useSim } from '../store/useSim';
import { savedScale } from './meterScale';
import { meterSizeFor } from './toolIcons';
import { clickToastLeft, JOB_LOG_TOAST_CLOSED } from './toastPlacement';

const CLOSE_MS = 280;
const EDGE = 8;
const SEVERITY: Record<LogKind, number> = { info: 0, sound: 0, good: 1, warn: 2, danger: 3 };

/** Messages produced by one click on a 3D object: shown at once, centred where the user clicked. */
interface ClickToast { key: number; x: number; y: number; ids: number[] }

const readingTime = (text: string): number => Math.max(3500, Math.min(8000, text.length * 45));

/**
 * Toasts for job-log messages. Ordinary messages queue in the corner one at a time. Messages caused by a
 * click on the 3D view (see clickScope) skip the queue and appear on the click point, so a tool error
 * shows right where the user was working.
 */
export function JobLogToasts(): ReactNode {
  const [queue, setQueue] = useState<LogEntry[]>([]);
  const [click, setClick] = useState<ClickToast | null>(null);
  const [closing, setClosing] = useState<{ id: number; x: number; y: number } | null>(null);
  const toast = useRef<HTMLDivElement>(null);
  const clickToast = useRef<HTMLDivElement>(null);
  const log = useSim((s) => s.log);
  const entry = queue[0];

  useEffect(() => useSim.subscribe((state, previous) => {
    if (state.sessionId !== previous.sessionId || state.phase === 'menu') {
      setQueue([]);
      setClick(null);
    }
    if (state.log === previous.log || state.sessionId === null) return;

    const lastId = previous.log.at(-1)?.id ?? -1;
    const added = state.log.filter((item) => item.id > lastId);
    if (added.length === 0) return;
    const scope = activeClick();
    if (scope) {
      setClick((current) => ({
        key: scope.key, x: scope.x, y: scope.y,
        ids: [...(current?.key === scope.key ? current.ids : []), ...added.map((item) => item.id)],
      }));
    } else {
      setQueue((pending) => [...pending, ...added]);
    }
  }), []);

  // Queued toast: reading time, then fly to the Job Log tab.
  useEffect(() => {
    if (!entry) return;
    // Give longer messages more reading time; new arrivals do not restart the timer.
    const duration = readingTime(entry.text);
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

  // Click toast: the click's messages (live from the log, so a later re-grade to a warning shows).
  const clickEntries = click ? click.ids.map((id) => log.find((item) => item.id === id)).filter((item): item is LogEntry => !!item) : [];
  const clickText = clickEntries.map((item) => item.text).join(' ');
  const clickKind = clickEntries.reduce<LogKind>((worst, item) => (SEVERITY[item.kind] > SEVERITY[worst] ? item.kind : worst), 'info');

  useEffect(() => {
    if (!click) return;
    const timer = window.setTimeout(() => setClick((current) => (current?.key === click.key ? null : current)), readingTime(clickText));
    return () => window.clearTimeout(timer);
  }, [click, clickText]);

  // Place the click toast at the click (beside the meter, if one is drawn there), kept inside the window.
  useLayoutEffect(() => {
    const element = clickToast.current;
    if (!element || !click) return;
    // offsetWidth/Height ignore the pop-in scale animation, so the position is exact.
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const { tool } = useSim.getState();
    const meter = meterSizeFor(tool);
    const underMouse = meter && !window.matchMedia('(pointer: coarse)').matches;
    const half = underMouse ? (meter.width / 2) * savedScale(tool) : null;
    const left = Math.min(Math.max(EDGE, clickToastLeft(click.x, width, window.innerWidth, half)), window.innerWidth - width - EDGE);
    const top = Math.min(Math.max(EDGE, click.y - height / 2), window.innerHeight - height - EDGE);
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
  }, [click, clickText]);

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
      {click && clickText && (
        <div ref={clickToast} key={click.key} className={`job-log-toast at-click log-${clickKind}`}>
          {clickText}
        </div>
      )}
    </div>
  );
}
