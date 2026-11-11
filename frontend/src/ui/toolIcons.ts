import type { ToolId } from '../store/useSim';

/**
 * Line icons on a 24x24 grid. Each is SVG markup with no stroke colour of its
 * own, so the same drawing serves as a toolbox button graphic and as the mouse
 * cursor. `FILL` marks the few shapes that are solid.
 */
const CAPACITOR =
  '<ellipse cx="12" cy="8" rx="5" ry="2"/><path d="M7 8v10a5 2 0 0 0 10 0V8M10 6.3V3M14 6.3V3"/>';
const FUSE = '<rect x="3" y="9" width="18" height="6" rx="1.5"/><path d="M7 9v6M17 9v6M7 12c2-2 3 2 5 0s3 2 5 0"/>';
const THERMOMETER =
  '<path d="M12 3a2 2 0 0 0-2 2v9.2a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2z"/><circle cx="12" cy="17.5" r="1.6" fill="FILL"/><path d="M12 16V8"/>';

const ICONS: Record<ToolId, string> = {
  hand: '<path d="M9 12V5.5a1.5 1.5 0 0 1 3 0V11l5 1a2 2 0 0 1 1.6 2v2.5a5 5 0 0 1-5 5h-1.8a5 5 0 0 1-4.3-2.5L5 14.6a1.4 1.4 0 0 1 2.2-1.7L9 14.6"/>',
  nutdriver:
    '<path d="M3.5 20.5l4-4" stroke-width="4.5"/><path d="M8 16l8-8"/><path d="M15 6.5l2.5-2 3 3-2 2.5z"/>',
  multimeter:
    '<rect x="6" y="2" width="12" height="20" rx="2"/><rect x="8.5" y="4.5" width="7" height="4.5"/><circle cx="12" cy="15" r="3"/><path d="M12 15l1.6-2.2"/>',
  clamp: '<path d="M9.5 12.5a5 5 0 1 1 5 0"/><path d="M12 3v2"/><rect x="9" y="12.5" width="6" height="9" rx="1.2"/><path d="M11 15.5h2"/>',
  ncv: '<path d="M5 19.5l9.5-9.5" stroke-width="4"/><path d="M14.5 10l3-3"/><path d="M16 3.5a4.5 4.5 0 0 1 4.5 4.5M15.5 1a7.5 7.5 0 0 1 7.5 7.5" stroke-width="1.3"/>',
  discharge: '<path d="M2 12h4l1.5-4 3 8 3-8 3 8 1.5-4h4"/><circle cx="2.5" cy="12" r="1" fill="FILL"/><circle cx="21.5" cy="12" r="1" fill="FILL"/>',
  gauges:
    '<circle cx="7" cy="8" r="4.5"/><circle cx="17" cy="8" r="4.5"/><path d="M7 8l2-2.5M17 8l-2.2-2"/><rect x="3" y="14" width="18" height="3" rx="1"/><path d="M6 17v4M12 17v4M18 17v4"/>',
  tempclamp: THERMOMETER,
  thermo: THERMOMETER,
  hose: '<rect x="7" y="10" width="8" height="11" rx="1.5"/><path d="M9 10V6.5h4V10M13 7.5h4l1 1.5"/><path d="M20.5 5.5l1 -1M21 8h1.5M20.5 10.5l1 1" stroke-width="1.3"/>',
  manometer: '<path d="M7 3v13a5 5 0 0 0 10 0V3"/><path d="M5 9h4M15 13h4" stroke-width="1.4"/><path d="M7 9v7a5 5 0 0 0 10 0v-3" stroke-width="3.2" opacity="0.45"/>',
  emery: '<rect x="3" y="8" width="18" height="9" rx="1.5" transform="rotate(-12 12 12)"/><path d="M7 12.5h.01M10.5 11h.01M10.5 14.5h.01M14 10.5h.01M14 13.5h.01M17.5 12h.01" stroke-width="2.2"/>',
  part_capacitor: CAPACITOR,
  part_blowercap: CAPACITOR,
  part_contactor:
    '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><circle cx="7.5" cy="7.5" r="1" fill="FILL"/><circle cx="16.5" cy="7.5" r="1" fill="FILL"/><circle cx="7.5" cy="16.5" r="1" fill="FILL"/><circle cx="16.5" cy="16.5" r="1" fill="FILL"/>',
  part_fanmotor:
    '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8C10.5 6 13 3 15.5 4c1 2.500-1 4.500-3.500 5.800z"/><path d="M12 9.8C10.5 6 13 3 15.5 4c1 2.500-1 4.500-3.500 5.800z" transform="rotate(120 12 12)"/><path d="M12 9.8C10.5 6 13 3 15.5 4c1 2.500-1 4.500-3.500 5.800z" transform="rotate(240 12 12)"/>',
  part_fuses: FUSE,
  part_fuse3a: FUSE,
  part_igniter: '<rect x="3" y="8.500" width="6" height="7" rx="1"/><path d="M9 10.500h10a1.500 1.500 0 0 1 0 3H9"/><path d="M13 7l1-2M16 7l1-2M19 7.500l1.500-1.500" stroke-width="1.3"/>',
  part_flamesensor: '<rect x="3" y="10" width="5" height="5" rx="1"/><path d="M8 12.500h8l4-5"/><path d="M19 15c1.500 1.500 1.500 3.500 0 5-1.500-1.500-1.500-3.500 0-5z" stroke-width="1.3"/>',
  part_pswitch: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.200"/><path d="M12 5V2M9 19v3M15 19v3"/>',
  part_inducer: '<circle cx="10.500" cy="13.500" r="6.500"/><circle cx="10.500" cy="13.500" r="2"/><path d="M10.500 7H20v5h-3.200"/>',
  part_gasvalve: '<rect x="5.500" y="9" width="13" height="8" rx="1"/><path d="M2 13h3.500M18.500 13H22M12 9V6"/><circle cx="12" cy="4.500" r="1.800"/>',
  part_filter: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9l4 3 4-3 4 3 4-3M4 15l4 3 4-3 4 3 4-3" stroke-width="1.400"/>',
  part_limit: '<circle cx="12" cy="10" r="6.500"/><path d="M8 10c2-2.500 6-2.500 8 0M9 16.200V21M15 16.200V21"/>',
  part_board: '<rect x="3" y="5" width="18" height="14" rx="1"/><rect x="6" y="8" width="5" height="4"/><path d="M14 8.500h4M14 11.500h4M6 15.500h.010M9 15.500h.010M12 15.500h.010M15 15.500h.010M18 15.500h.010" stroke-width="1.800"/>',
};

function group(tool: ToolId, color: string, width: number, extra = ''): string {
  const body = ICONS[tool].replaceAll('FILL', color);
  return `<g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</g>`;
}

const dataUrl = (svg: string): string => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Icon as a CSS background image, for the toolbox buttons. */
export function toolIconUrl(tool: ToolId, color: string): string {
  return dataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${group(tool, color, 1.7)}</svg>`,
  );
}

const cursorCache = new Map<ToolId, string>();

/**
 * Mouse cursor for a tool: a small pointer arrow (the hot spot) carrying the
 * tool's icon, outlined in white so it reads over any part of the scene.
 */
export function toolCursor(tool: ToolId): string {
  const cached = cursorCache.get(tool);
  if (cached) return cached;
  const place = 'transform="translate(10 10) scale(0.9)"';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<circle cx="20.800" cy="20.800" r="11" fill="#ffffff" fill-opacity="0.820" stroke="#10141a" stroke-width="1"/>` +
    group(tool, '#10141a', 1.9, place) +
    `<path d="M1.500 1.500v10.500l3-2.600 2.300 5 2-0.900-2.300-4.900h4.200z" fill="#ffffff" stroke="#10141a" stroke-width="1.200" stroke-linejoin="round"/>` +
    `</svg>`;
  const cursor = `${dataUrl(svg)} 2 2, pointer`;
  cursorCache.set(tool, cursor);
  return cursor;
}
