import type { MeterMode, MeterReading } from '../sim/instruments';

/** Multimeter dial positions, in order. µA is for the furnace flame-sensor test only. */
export const MODES: ReadonlyArray<{ id: MeterMode; label: string; furnaceOnly?: boolean }> = [
  { id: 'vac', label: 'V~' },
  { id: 'ohm', label: 'Ω' },
  { id: 'uf', label: 'µF' },
  { id: 'ua', label: 'µA', furnaceOnly: true },
];

/** The multimeter's display text, shared by the INSTRUMENTS panel and the on-screen meter. */
export function formatReading(r: MeterReading): { main: string; unit: string; sub: string; alert: boolean } {
  switch (r.kind) {
    case 'idle':
      return { main: '- - -', unit: '', sub: 'Place both leads', alert: false };
    case 'ol':
      return { main: 'OL', unit: 'Ω', sub: `Open circuit${r.note ? ` (${r.note})` : ''}`, alert: false };
    case 'live':
      return { main: 'LIVE', unit: '', sub: `${r.volts.toFixed(0)} V present - switch to volts!`, alert: true };
    case 'na':
      return { main: '- - -', unit: '', sub: r.note, alert: false };
    case 'value': {
      const v = r.value;
      let main: string;
      let unit: string = r.unit;
      if (r.unit === 'V' || r.unit === 'µF') main = v.toFixed(1);
      else if (r.unit === 'µA') main = v.toFixed(2);
      else if (v >= 1000) {
        main = (v / 1000).toFixed(2);
        unit = 'kΩ';
      } else main = v < 100 ? v.toFixed(2) : v.toFixed(1);
      const beep = r.unit === 'Ω' && v < 30 ? 'continuity' : '';
      return { main, unit, sub: [beep, r.note].filter(Boolean).join(' - '), alert: false };
    }
  }
}
