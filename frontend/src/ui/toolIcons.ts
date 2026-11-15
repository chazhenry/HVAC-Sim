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
  speak: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
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

// ---------- clamp meter cursor ----------

/** Lit segments for each character of a seven-segment LCD (a top, b upper right … g middle). */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd', '6': 'afgedc',
  '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '',
  // Letters a meter shows: OL (open), LIVE (volts on an ohms or capacitance range).
  O: 'abcdef', L: 'def', I: 'ef', V: 'bcdef', E: 'adefg',
};

/** One seven-segment digit, 7×13 px, with its top-left at (x, y). */
function segmentDigit(char: string, x: number, y: number, on: string, off: string): string {
  const lit = SEGMENTS[char] ?? '';
  const t = 1.7;
  const w = 7;
  const h = 6.5;
  const bars: Record<string, [number, number, number, number]> = {
    a: [x + 1, y, w - 2, t], g: [x + 1, y + h - t / 2, w - 2, t], d: [x + 1, y + 2 * h - t, w - 2, t],
    f: [x, y + 0.8, t, h - 1], b: [x + w - t, y + 0.8, t, h - 1],
    e: [x, y + h + 0.2, t, h - 1], c: [x + w - t, y + h + 0.2, t, h - 1],
  };
  return Object.entries(bars).map(([id, [bx, by, bw, bh]]) =>
    `<rect x="${bx.toFixed(2)}" y="${by.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="0.5" fill="${lit.includes(id) ? on : off}"/>`).join('');
}

/** Up to four digits right-aligned in the LCD, with decimal points between them, e.g. "12.4" or "0.00". */
export function lcdDigits(text: string, right: number, y: number, on = '#1c1f1a', off = 'rgba(28,31,26,0.07)'): string {
  const chars: Array<{ c: string; dot: boolean }> = [];
  for (const c of text) {
    if (c === '.' && chars.length) chars[chars.length - 1]!.dot = true;
    else chars.push({ c, dot: false });
  }
  while (chars.length < 4) chars.unshift({ c: ' ', dot: false });
  const pitch = 10;
  const left = right - pitch * chars.length + 3;
  return chars.slice(-4).map(({ c, dot }, i) => {
    const x = left + i * pitch;
    // Skewed slightly, like a real LCD.
    return `<g transform="skewX(-6) translate(${(y * 0.105).toFixed(2)} 0)">${segmentDigit(c, x, y, on, off)}</g>` +
      (dot ? `<rect x="${(x + 7.2).toFixed(2)}" y="${y + 11.3}" width="1.7" height="1.7" fill="${on}"/>` : '');
  }).join('');
}

const clampCache = new Map<string, string>();

/**
 * Mouse cursor for the clamp tool: a clamp meter drawn like a real one (yellow jaws, dark head,
 * blue body, grey LCD) showing the live reading. The hot spot is the centre of the jaws.
 * 76 × 128 px, the largest cursor browsers allow.
 */
export function clampMeterCursor(reading: string | null, rejected = false, caption = ''): string {
  const key = `${reading ?? ''}|${rejected ? 'x' : ''}|${caption}`;
  const cached = clampCache.get(key);
  if (cached) return cached;
  const shown = reading ?? '---';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="128" viewBox="0 0 76 128">` +
    // Jaws, open at the top, with a dark outline so they read over any background.
    `<path d="M35 7.6A22.5 22.5 0 1 0 41 7.6" fill="none" stroke="#10141a" stroke-width="12" stroke-linecap="round"/>` +
    `<path d="M35 7.6A22.5 22.5 0 1 0 41 7.6" fill="none" stroke="#f2b01e" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M24 22a17 17 0 0 1 28 0" fill="none" stroke="#c98a00" stroke-width="1" stroke-dasharray="2 3"/>` +
    // Hot spot marker: the wire goes here.
    `<circle cx="38" cy="30" r="2.2" fill="#ffffff" stroke="#10141a" stroke-width="1"/>` +
    // Dark head with the AC symbol and rating, then the blue body.
    `<path d="M14 50h48l-3 18H17z" fill="#24272b" stroke="#10141a" stroke-width="1"/>` +
    `<text x="20" y="62" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="700" fill="#e9eaec">~600A</text>` +
    `<path d="M50 55l-3 5h3l-2 5" fill="none" stroke="#f2b01e" stroke-width="1.2"/>` +
    `<rect x="12" y="66" width="52" height="60" rx="6" fill="#2f63c9" stroke="#10141a" stroke-width="1"/>` +
    // LCD.
    `<rect x="16" y="71" width="44" height="34" rx="2" fill="#cdd3c4" stroke="#10141a" stroke-width="0.8"/>` +
    `<text x="19" y="78" font-family="Arial,Helvetica,sans-serif" font-size="5" font-weight="700" fill="#1c1f1a">AC~</text>` +
    `<text x="57" y="78" font-family="Arial,Helvetica,sans-serif" font-size="5" font-weight="700" fill="#1c1f1a" text-anchor="end">AUTO</text>` +
    lcdDigits(shown, 50, 82) +
    `<text x="57" y="99" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="700" fill="#1c1f1a" text-anchor="end">A</text>` +
    // Small caption under the digits, as on the instrument panel: which wire is clamped, e.g. "Compressor common".
    lcdCaption(caption) +
    // Rotary selector and buttons.
    `<circle cx="38" cy="116" r="6.5" fill="#2a2d31" stroke="#10141a" stroke-width="1"/>` +
    `<path d="M38 110.5v4" stroke="#e9eaec" stroke-width="1.4"/>` +
    `<rect x="18" y="109" width="9" height="5" rx="1.5" fill="#24272b"/><rect x="49" y="109" width="9" height="5" rx="1.5" fill="#24272b"/>` +
    // Irrelevant wire: a bold red ✕ in the jaws' crosshair, right on the wire that was clicked.
    (rejected
      ? `<path d="M29 21l18 18M47 21l-18 18" stroke="#10141a" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M29 21l18 18M47 21l-18 18" stroke="#e53935" stroke-width="4.5" stroke-linecap="round"/>`
      : '') +
    `</svg>`;
  const cursor = `${dataUrl(svg)} 38 30, crosshair`;
  if (clampCache.size > 400) clampCache.clear();
  clampCache.set(key, cursor);
  return cursor;
}

/** The clamp meter's display text, matching the instrument panel: "0.00" below 1 A, else one decimal. */
export function clampDisplay(amps: number): string {
  if (amps >= 999.5) return Math.min(9999, Math.round(amps)).toString();
  return amps.toFixed(amps < 1 ? 2 : 1);
}

/** The clamp meter drawing as an image URL, for the scalable on-screen meter (ClampMeterCursor). */
export function clampMeterImage(reading: string | null, rejected = false, caption = ''): string {
  return /url\("(.*)"\)/.exec(clampMeterCursor(reading, rejected, caption))?.[1] ?? '';
}

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One line of small LCD text along the bottom of the display, squeezed to fit if it is long. */
function lcdCaption(caption: string, x = 38, y = 103.4, maxWidth = 40): string {
  if (!caption) return '';
  // Bold Arial at 4.4 px averages about 2.6 px a character.
  const fit = caption.length * 2.6 > maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="4.4" font-weight="700" fill="#1c1f1a" text-anchor="middle"${fit}>${escapeXml(caption)}</text>`;
}

// ---------- multimeter ----------

export interface MultimeterFace {
  /** LCD text, e.g. "120.4", "OL", "LIVE" or "---". */
  main: string;
  unit: string;
  sub: string;
  alert: boolean;
  /** Dial labels in order, and which one is selected. */
  modes: readonly string[];
  mode: number;
  /** The lead that goes on next: its colour is the probe tip at the cursor's hot spot. */
  next: 'red' | 'black';
  redPlaced: boolean;
  blackPlaced: boolean;
}

/** Drawing size and probe tip (hot spot), in px at scale 1. */
export const MULTIMETER_SIZE = { width: 80, height: 128, hotX: 40, hotY: 3 } as const;

const meterCache = new Map<string, string>();

/**
 * The multimeter as an image for the on-screen meter: a test probe on top (its tip is where the lead
 * goes, coloured for the next lead), then the meter: LCD with the live reading, rotary dial pointing at
 * the selected range, and the COM / V-Ω jacks lit for leads already placed.
 */
export function multimeterImage(face: MultimeterFace): string {
  const key = JSON.stringify(face);
  const cached = meterCache.get(key);
  if (cached) return cached;
  const lead = face.next === 'red' ? '#d32f2f' : '#1d1d1f';
  const leadEdge = face.next === 'red' ? '#7f1010' : '#000';
  const lcd = face.alert ? '#f1c4bd' : '#cdd3c4';
  const shown = face.main.replace(/\s+/g, '') || '---';
  // Dial: pointer at the selected range; labels spread over the upper arc.
  const cx = 40;
  const cy = 98;
  const span = face.modes.length > 1 ? 120 : 0;
  const angleOf = (i: number): number => (-90 - span / 2 + (face.modes.length > 1 ? (span * i) / (face.modes.length - 1) : 0)) * Math.PI / 180;
  const labels = face.modes.map((label, i) => {
    const a = angleOf(i);
    const selected = i === face.mode;
    return `<text x="${(cx + Math.cos(a) * 17).toFixed(1)}" y="${(cy + Math.sin(a) * 17 + 2).toFixed(1)}" font-family="Arial,Helvetica,sans-serif" font-size="${selected ? 5.6 : 4.6}" font-weight="700" fill="${selected ? '#ffd54a' : '#c9ccd1'}" text-anchor="middle">${escapeXml(label)}</text>`;
  }).join('');
  const pointer = angleOf(face.mode);
  const jack = (x: number, color: string, placed: boolean): string =>
    `<circle cx="${x}" cy="118" r="3.6" fill="${placed ? color : '#111'}" stroke="${color === '#1d1d1f' ? '#9aa0a6' : color}" stroke-width="1.4"/>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="128" viewBox="0 0 80 128">` +
    // Probe: steel tip (the hot spot) and handle in the next lead's colour, its cord running to the jack.
    `<path d="M40 30c0 10-14 8-16 22" fill="none" stroke="${lead}" stroke-width="2.2"/>` +
    `<path d="M40 3v10" stroke="#10141a" stroke-width="3.6" stroke-linecap="round"/>` +
    `<path d="M40 3v10" stroke="#d9dde2" stroke-width="1.8" stroke-linecap="round"/>` +
    `<rect x="36" y="12" width="8" height="19" rx="2.5" fill="${lead}" stroke="${leadEdge}" stroke-width="1"/>` +
    `<rect x="34.5" y="12" width="11" height="3" rx="1.2" fill="${lead}" stroke="${leadEdge}" stroke-width="0.8"/>` +
    // Meter: yellow holster, dark face.
    `<rect x="7" y="40" width="66" height="86" rx="9" fill="#f2b01e" stroke="#10141a" stroke-width="1"/>` +
    `<rect x="12" y="45" width="56" height="76" rx="5" fill="#2a2d31"/>` +
    // LCD with the reading, unit and a one-line note.
    `<rect x="15" y="48" width="50" height="30" rx="2" fill="${lcd}" stroke="#10141a" stroke-width="0.8"/>` +
    `<text x="18" y="54.5" font-family="Arial,Helvetica,sans-serif" font-size="4.6" font-weight="700" fill="#1c1f1a">${escapeXml(face.modes[face.mode] ?? '')}</text>` +
    `<text x="62" y="54.5" font-family="Arial,Helvetica,sans-serif" font-size="4.6" font-weight="700" fill="#1c1f1a" text-anchor="end">AUTO</text>` +
    lcdDigits(shown, 53, 56.5) +
    `<text x="63.5" y="69.5" font-family="Arial,Helvetica,sans-serif" font-size="6.5" font-weight="700" fill="#1c1f1a" text-anchor="end">${escapeXml(face.unit)}</text>` +
    lcdCaption(face.sub, 40, 76, 46) +
    // Rotary dial.
    labels +
    `<circle cx="${cx}" cy="${cy}" r="10" fill="#1b1d20" stroke="#5b5f66" stroke-width="1"/>` +
    `<path d="M${cx} ${cy}L${(cx + Math.cos(pointer) * 9).toFixed(1)} ${(cy + Math.sin(pointer) * 9).toFixed(1)}" stroke="#ffd54a" stroke-width="2.2" stroke-linecap="round"/>` +
    // Jacks: COM (black) and V-Ω (red), lit when that lead is placed.
    jack(30, '#1d1d1f', face.blackPlaced) + jack(50, '#d32f2f', face.redPlaced) +
    `<text x="30" y="125" font-family="Arial,Helvetica,sans-serif" font-size="3.6" fill="#c9ccd1" text-anchor="middle">COM</text>` +
    `<text x="50" y="125" font-family="Arial,Helvetica,sans-serif" font-size="3.6" fill="#c9ccd1" text-anchor="middle">VΩ</text>` +
    `</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (meterCache.size > 400) meterCache.clear();
  meterCache.set(key, url);
  return url;
}

// ---------- voltage tester ----------

export interface TesterFace {
  /** null: not on a terminal yet. */
  hot: boolean | null;
  /** Terminal name, e.g. "Contactor L1 (line)". */
  point: string;
}

/** On-screen size and tip (hot spot): the 64 × 128 drawing shown at half size; the tip touches the terminal. */
export const TESTER_SIZE = { width: 32, height: 64, hotX: 16, hotY: 1.5 } as const;

const testerCache = new Map<string, string>();

/**
 * Non-contact voltage tester as an image: a pen whose clear tip glows red on a live terminal and
 * green on a dead one, with a small tag below giving the result and the terminal.
 */
export function testerImage(face: TesterFace): string {
  const key = JSON.stringify(face);
  const cached = testerCache.get(key);
  if (cached) return cached;
  const glow = face.hot === null ? '#9aa3ab' : face.hot ? '#ff3b30' : '#34c759';
  const status = face.hot === null ? 'TAP A TERMINAL' : face.hot ? 'HOT' : 'NO VOLTAGE';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="128" viewBox="0 0 64 128">` +
    (face.hot
      ? `<circle cx="32" cy="12" r="13" fill="${glow}" opacity="0.28"/>` +
        `<path d="M16 4l-5-3M48 4l5-3M14 16l-6 1M50 16l6 1" stroke="${glow}" stroke-width="2" stroke-linecap="round"/>`
      : '') +
    // Clear tip (the hot spot) lit in the result colour.
    `<path d="M32 2C28 6 26 12 26 22h12c0-10-2-16-6-20z" fill="${glow}" fill-opacity="0.85" stroke="#10141a" stroke-width="1"/>` +
    `<path d="M30 8c-1 3-1.5 6-1.5 10" stroke="#fff" stroke-opacity="0.6" stroke-width="1.2" fill="none"/>` +
    // Pen body: yellow with a black grip and pocket clip.
    `<rect x="24" y="21" width="16" height="70" rx="5" fill="#f2b01e" stroke="#10141a" stroke-width="1"/>` +
    `<rect x="24" y="52" width="16" height="22" fill="#24272b"/>` +
    `<path d="M40 26h3v28" fill="none" stroke="#9aa0a6" stroke-width="2" stroke-linecap="round"/>` +
    `<text x="32" y="42" font-family="Arial,Helvetica,sans-serif" font-size="5" font-weight="800" fill="#10141a" text-anchor="middle" transform="rotate(-90 32 40)">VOLT</text>` +
    `<circle cx="32" cy="83" r="3" fill="${face.hot === null ? '#3a3f45' : glow}" stroke="#10141a" stroke-width="0.8"/>` +
    // Result tag.
    `<rect x="3" y="96" width="58" height="29" rx="4" fill="#cdd3c4" stroke="#10141a" stroke-width="0.8"/>` +
    `<text x="32" y="108" font-family="Arial,Helvetica,sans-serif" font-size="${face.hot ? 9 : face.hot === false ? 6.4 : 5.2}" font-weight="800" fill="${face.hot ? '#c62828' : face.hot === false ? '#1b7a3a' : '#1c1f1a'}" text-anchor="middle">${status}</text>` +
    lcdCaption(face.point, 32, 119.5, 52) +
    `</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (testerCache.size > 200) testerCache.clear();
  testerCache.set(key, url);
  return url;
}

// ---------- temperature clamp meter ----------

export interface TempClampFace {
  /** Line temperatures in °F, or null where no clamp is on that line. */
  suction: number | null;
  liquid: number | null;
  /** Shown when gauges are on and the readings allow it. */
  superheat: number | null;
  subcool: number | null;
  /** True in heat-pump heating, when the big line carries hot gas. */
  heating: boolean;
}

/** On-screen size and the pipe jaw's centre (hot spot): the 76 × 104 drawing shown at half size. */
export const TEMP_CLAMP_SIZE = { width: 38, height: 52, hotX: 19, hotY: 10 } as const;

const tempCache = new Map<string, string>();

/**
 * Pipe-clamp thermometer as an image: spring jaws on top (their centre goes on the line), then a
 * display listing each clamped line's temperature and, with the gauges connected, superheat and subcooling.
 */
export function tempClampImage(face: TempClampFace): string {
  const key = JSON.stringify(face);
  const cached = tempCache.get(key);
  if (cached) return cached;
  const f = (value: number | null): string => (value === null ? '--' : `${value.toFixed(1)}°F`);
  const row = (y: number, label: string, value: string, strong = false): string =>
    `<text x="18" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="5.2" font-weight="700" fill="#1c1f1a">${escapeXml(label)}</text>` +
    `<text x="60" y="${y}" font-family="Consolas,monospace" font-size="${strong ? 6.4 : 5.8}" font-weight="800" fill="#1c1f1a" text-anchor="end">${escapeXml(value)}</text>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="104" viewBox="0 0 76 104">` +
    // Spring jaws around a pipe-sized opening; the centre dot is the hot spot.
    `<path d="M24 22a14 14 0 0 1 28 0" fill="none" stroke="#10141a" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M24 22a14 14 0 0 1 28 0" fill="none" stroke="#f2c200" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M24 22l-4 16M52 22l4 16" stroke="#10141a" stroke-width="5" stroke-linecap="round"/>` +
    `<path d="M24 22l-4 16M52 22l4 16" stroke="#f2c200" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="38" cy="20" r="2.2" fill="#ffffff" stroke="#10141a" stroke-width="1"/>` +
    // Body and display.
    `<rect x="12" y="38" width="52" height="${face.superheat !== null || face.subcool !== null ? 63 : 47}" rx="7" fill="#2f63c9" stroke="#10141a" stroke-width="1"/>` +
    `<text x="38" y="47" font-family="Arial,Helvetica,sans-serif" font-size="5" font-weight="800" fill="#e9eaec" text-anchor="middle">PIPE TEMP</text>` +
    `<rect x="14" y="51" width="48" height="${face.superheat !== null || face.subcool !== null ? 46 : 30}" rx="2" fill="#cdd3c4" stroke="#10141a" stroke-width="0.8"/>` +
    row(61, face.heating ? 'VAPOR' : 'SUCT', f(face.suction)) +
    row(74, 'LIQ', f(face.liquid)) +
    (face.superheat !== null ? row(86, 'SH', f(face.superheat), true) : '') +
    (face.subcool !== null ? row(face.superheat !== null ? 94 : 86, 'SC', f(face.subcool), true) : '') +
    (face.suction === null && face.liquid === null ? lcdCaption('Clamp a refrigerant line', 38, 84, 44) : '') +
    `</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (tempCache.size > 300) tempCache.clear();
  tempCache.set(key, url);
  return url;
}

/** Size and hot spot of the drawn instrument for a tool, or null if the tool uses the plain cursor. */
export function meterSizeFor(tool: string): { width: number; height: number; hotX: number; hotY: number } | null {
  switch (tool) {
    case 'clamp': return { width: 76, height: 128, hotX: 38, hotY: 30 };
    case 'multimeter': return MULTIMETER_SIZE;
    case 'ncv': return TESTER_SIZE;
    case 'tempclamp': return TEMP_CLAMP_SIZE;
    default: return null;
  }
}
