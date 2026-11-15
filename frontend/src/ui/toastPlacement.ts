/** Toast placement helpers and the event fired when a queued toast closes. */

export const JOB_LOG_TOAST_CLOSED = 'hvac:job-log-toast-closed';

/** Space between a meter drawn under the mouse and a toast placed beside it. */
const BESIDE_GAP = 14;

/**
 * Where a click toast goes: beside the meter under the mouse (clamp meter or multimeter), on the side
 * with more room, so the meter never covers it; otherwise centred on the click.
 */
export function clickToastLeft(x: number, width: number, viewportWidth: number, meterHalfWidth: number | null): number {
  const centred = x - width / 2;
  if (meterHalfWidth === null) return centred;
  const roomRight = viewportWidth - x;
  return roomRight >= x ? x + meterHalfWidth + BESIDE_GAP : x - meterHalfWidth - BESIDE_GAP - width;
}
