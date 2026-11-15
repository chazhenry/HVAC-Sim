/** Sizes of the drawn instruments and their remembered Ctrl + wheel scale. */

/** The clamp drawing's size and the jaw centre (the point that clamps), in px at scale 1. */
export const CLAMP = { width: 76, height: 128, hotX: 38, hotY: 30 };

interface ScaleRange { min: number; max: number }

/**
 * Ctrl + wheel size range for each drawn instrument, as a factor of its on-screen size. The voltage
 * tester and temp clamp start small (half their drawing), so they may shrink less and grow much more.
 */
const RANGES: Record<string, ScaleRange> = {
  clamp: { min: 0.5, max: 3 },
  multimeter: { min: 0.5, max: 3 },
  ncv: { min: 0.75, max: 6 },
  tempclamp: { min: 0.75, max: 6 },
};
const DEFAULT_RANGE: ScaleRange = { min: 0.5, max: 3 };
export const scaleRange = (tool: string): ScaleRange => RANGES[tool] ?? DEFAULT_RANGE;

/** Each instrument remembers its own size (the clamp keeps its original key). */
export const scaleKey = (tool: string): string => (tool === 'clamp' ? 'hvac-sim.clamp-meter-scale' : `hvac-sim.meter-scale.${tool}`);

/** An instrument's current on-screen size factor (Ctrl + wheel), e.g. for placing toasts beside it. */
export function savedScale(tool = 'clamp'): number {
  const { min, max } = scaleRange(tool);
  try {
    const value = Number(window.localStorage.getItem(scaleKey(tool)));
    return Number.isFinite(value) && value >= min && value <= max ? value : 1;
  } catch {
    return 1;
  }
}

/** One wheel notch scales by 10 %, kept within the instrument's range. */
export function nextScale(scale: number, deltaY: number, range: ScaleRange = DEFAULT_RANGE): number {
  const next = deltaY < 0 ? scale * 1.1 : scale / 1.1;
  return Math.round(Math.min(range.max, Math.max(range.min, next)) * 100) / 100;
}
