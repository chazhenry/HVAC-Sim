import { cabs, cadd, type Complex, ZERO } from '../circuit';
import type { MeterMode, MeterReading } from '../instruments';
import { fMeasureOhmsInCircuit, fMeasureOhmsIsolated, fMeasureVolts } from './electrical';
import { flameMicroamps, fSwitchState, type FurnaceState } from './engine';
import { F_CLAMP_POINTS, F_TEST_POINTS, type FClampPointId, type FTestPointDef, type FTestPointId } from './testPoints';

const point = (id: FTestPointId): FTestPointDef => F_TEST_POINTS[id];

export function fProbeVolts(s: FurnaceState, a: FTestPointId, b: FTestPointId): number {
  return fMeasureVolts(s.unit, fSwitchState(s), point(a).node, point(b).node);
}

export function fIsHot(s: FurnaceState, id: FTestPointId): boolean {
  return cabs(s.solution.v[point(id).node]) > 50;
}

export function fReadMeter(
  s: FurnaceState,
  mode: MeterMode,
  red: FTestPointId | null,
  black: FTestPointId | null,
): MeterReading {
  if (red === null || black === null) return { kind: 'idle' };
  const a = point(red);
  const b = point(black);

  if (mode === 'ua') {
    // Flame current is read with the meter in series between the sensor and the board.
    const inSeries = [red, black].includes('F_FS_ROD') && [red, black].includes('F_BD_FS');
    if (!inSeries) return { kind: 'na', note: 'Leads on the flame sensor and board FS' };
    return { kind: 'value', value: flameMicroamps(s), unit: 'µA', note: 'in series with flame sensor' };
  }

  const volts = fProbeVolts(s, red, black);
  if (mode === 'vac') return { kind: 'value', value: volts, unit: 'V' };
  if (volts > 3) return { kind: 'live', volts };

  const samePart = a.part !== undefined && a.part === b.part && red !== black;
  if (mode === 'uf') {
    if (!samePart || a.part !== 'blowerCap') return { kind: 'na', note: 'Put both leads on capacitor terminals' };
    return { kind: 'value', value: s.unit.blowerCapUf, unit: 'µF', note: 'leads pulled for test' };
  }

  let ohms: number;
  let note: string;
  if (samePart && a.part !== undefined) {
    ohms = fMeasureOhmsIsolated(s.unit, fSwitchState(s), a.part);
    note = 'leads pulled for test';
  } else {
    ohms = fMeasureOhmsInCircuit(s.unit, fSwitchState(s), a.node, b.node);
    note = 'in circuit';
  }
  if (!Number.isFinite(ohms)) return { kind: 'ol', note };
  return { kind: 'value', value: ohms, unit: 'Ω', note };
}

export function fReadClamp(s: FurnaceState, id: FClampPointId): number {
  const total = F_CLAMP_POINTS[id].elements.reduce<Complex>((acc, el) => cadd(acc, s.solution.i[el]), ZERO);
  const amps = cabs(total);
  return amps < 0.02 ? 0 : amps * (1 + 0.006 * Math.sin(s.t * 5.3));
}
