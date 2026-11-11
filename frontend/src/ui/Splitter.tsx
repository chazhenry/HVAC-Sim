import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useState } from 'react';

const KEY = 'hvac-sim.job-pane-width';
const MIN = 280;
/** Always leave this much room for the tool bag and the 3D view. */
const RESERVED = 520;

const clampWidth = (px: number): number => Math.round(Math.max(MIN, Math.min(px, window.innerWidth - RESERVED)));

function saved(): number | null {
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(n) && n >= MIN ? n : null;
  } catch {
    return null;
  }
}

/**
 * Width of the right-hand pane as chosen by dragging the splitter. null means
 * "not chosen": the stylesheet's default applies.
 */
export function usePaneWidth(): { width: number | null; style: CSSProperties; set: (px: number | null) => void } {
  const [width, setWidth] = useState<number | null>(saved);
  const set = useCallback((px: number | null) => {
    const next = px === null ? null : clampWidth(px);
    setWidth(next);
    try {
      if (next === null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, String(next));
    } catch {
      // Storage can be blocked; the width then lasts for this visit only.
    }
  }, []);
  // Clamp on the way out too, so a width saved on a wide screen still fits a narrow one.
  const style = width === null ? {} : ({ '--job-w': `${clampWidth(width)}px` } as CSSProperties);
  return { width, style, set };
}

/** Drag handle between the 3D view and the right-hand pane. */
export function Splitter({ width, onChange }: { width: number | null; onChange: (px: number | null) => void }): ReactNode {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    if (dragging) onChange(window.innerWidth - e.clientX - 3);
  };
  const stop = (): void => setDragging(false);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const now = width ?? e.currentTarget.nextElementSibling?.getBoundingClientRect().width ?? 340;
    if (e.key === 'ArrowLeft') onChange(now + 24);
    else if (e.key === 'ArrowRight') onChange(now - 24);
    else if (e.key === 'Home' || e.key === 'Escape') onChange(null);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className={`splitter${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the right-hand pane"
      title="Drag to resize · double-click to reset"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onChange(null)}
      onKeyDown={onKeyDown}
    />
  );
}
