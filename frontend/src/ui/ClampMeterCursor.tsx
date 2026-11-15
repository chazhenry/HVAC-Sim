import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { clampMeterImage } from './toolIcons';
import { CLAMP, nextScale, savedScale, scaleKey, scaleRange } from './meterScale';

/**
 * The clamp meter drawn under the mouse instead of a native cursor, because browsers cap cursor
 * images at 128 px. Ctrl + mouse wheel (or a trackpad pinch) scales it; the size is remembered.
 */
export function ClampMeterCursor({ reading, rejected, caption }: { reading: string | null; rejected: boolean; caption: string }): ReactNode {
  const src = useMemo(() => clampMeterImage(reading, rejected, caption), [reading, rejected, caption]);
  return <MeterCursor tool="clamp" src={src} size={CLAMP} />;
}

/**
 * Any hand-held instrument drawn under the mouse: `size.hotX/hotY` is the point of the drawing that sits
 * exactly at the mouse (the clamp's jaw centre, the multimeter's probe tip). Hidden for touch and while
 * right-drag panning. Mount one per tool (key it by tool) so each keeps its own size.
 */
export function MeterCursor({ tool, src, size }: {
  tool: string; src: string; size: { width: number; height: number; hotX: number; hotY: number };
}): ReactNode {
  const img = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(() => savedScale(tool));

  useEffect(() => {
    try { window.localStorage.setItem(scaleKey(tool), String(scale)); } catch { /* Keep the size for this visit only. */ }
  }, [tool, scale]);

  useEffect(() => {
    const viewport = img.current?.parentElement;
    if (!viewport) return;
    const place = (event: PointerEvent): void => {
      const element = img.current;
      if (!element) return;
      // Anywhere over the 3D view, including the range strip and its buttons: the instrument is the
      // pointer there (its probe tip or jaw centre is the click point).
      const show = event.pointerType !== 'touch' && (event.buttons & 2) === 0;
      element.hidden = !show;
      if (show) element.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    };
    const hide = (): void => { if (img.current) img.current.hidden = true; };
    const range = scaleRange(tool);
    const wheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) return;
      // Ctrl + wheel resizes the instrument instead of zooming the camera or the page.
      event.preventDefault();
      event.stopPropagation();
      setScale((current) => nextScale(current, event.deltaY, range));
    };
    viewport.addEventListener('pointermove', place);
    viewport.addEventListener('pointerdown', place);
    viewport.addEventListener('pointerleave', hide);
    viewport.addEventListener('wheel', wheel, { passive: false, capture: true });
    return () => {
      viewport.removeEventListener('pointermove', place);
      viewport.removeEventListener('pointerdown', place);
      viewport.removeEventListener('pointerleave', hide);
      viewport.removeEventListener('wheel', wheel, { capture: true });
    };
  }, [tool]);

  return (
    <img ref={img} className="clamp-meter-cursor" src={src} alt="" aria-hidden="true" hidden draggable={false}
      style={{ width: size.width * scale, height: size.height * scale, marginLeft: -size.hotX * scale, marginTop: -size.hotY * scale }} />
  );
}
