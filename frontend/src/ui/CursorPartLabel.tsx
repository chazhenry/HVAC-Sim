import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePowerCommands } from '../store/usePowerCommands';
import { useSim } from '../store/useSim';

/** Display the exact footer hover text after the active tool's cursor icon. */
export function CursorPartLabel(): ReactNode {
  const enabled = usePowerCommands((state) => state.listMode);
  const hover = useSim((state) => state.hover);
  const label = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const viewport = label.current?.parentElement;
    if (!viewport || !enabled) { setPointer(null); return; }
    const move = (event: PointerEvent): void => {
      setPointer(event.target instanceof HTMLCanvasElement && event.pointerType !== 'touch'
        ? { x: event.clientX, y: event.clientY } : null);
    };
    const leave = (): void => setPointer(null);
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerleave', leave);
    return () => {
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerleave', leave);
    };
  }, [enabled]);

  useLayoutEffect(() => {
    const element = label.current;
    if (!element || !pointer || !enabled || !hover) return;
    const bounds = element.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    element.style.maxWidth = `${Math.max(0, Math.min(320, bounds.width - 16))}px`;
    const right = Math.min(bounds.right, window.innerWidth) - 8;
    const bottom = Math.min(bounds.bottom, window.innerHeight) - 8;
    let x = pointer.x + 40; // The existing tool cursor is 32px wide.
    if (x + element.offsetWidth > right) x = pointer.x - element.offsetWidth - 12;
    element.style.left = `${Math.max(bounds.left + 8, Math.min(x, right - element.offsetWidth))}px`;
    element.style.top = `${Math.max(bounds.top + 8, Math.min(pointer.y + 12, bottom - element.offsetHeight))}px`;
  }, [pointer, hover, enabled]);

  return <div ref={label} className="cursor-part-label" hidden={!enabled || !hover || !pointer} aria-hidden="true">{hover}</div>;
}
