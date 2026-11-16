/** Toast placement helpers and the event fired when a queued toast closes. */

export const JOB_LOG_TOAST_CLOSED = 'hvac:job-log-toast-closed';

/** Space between the tool icon under the mouse and a toast placed beside it. */
const BESIDE_GAP = 14;

/** A screen rectangle in px. */
export interface Box { left: number; top: number; right: number; bottom: number }

/** Where the tool icon is drawn for a click at (x, y): the icon's size and its hot spot, at the given scale. */
export function iconBox(x: number, y: number, icon: { width: number; height: number; hotX: number; hotY: number }, scale = 1): Box {
  return {
    left: x - icon.hotX * scale,
    top: y - icon.hotY * scale,
    right: x + (icon.width - icon.hotX) * scale,
    bottom: y + (icon.height - icon.hotY) * scale,
  };
}

/**
 * Where a click toast goes: beside the tool icon, on whichever side has more width left in the 3D view,
 * vertically centred on the icon and kept inside the view.
 */
export function toastBesideIcon(icon: Box, width: number, height: number, area: Box): { left: number; top: number } {
  const roomRight = area.right - icon.right;
  const roomLeft = icon.left - area.left;
  const left = roomRight >= roomLeft ? icon.right + BESIDE_GAP : icon.left - BESIDE_GAP - width;
  const centre = (icon.top + icon.bottom) / 2 - height / 2;
  const top = Math.min(Math.max(area.top, centre), area.bottom - height);
  return { left, top };
}
