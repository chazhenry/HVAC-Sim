import { cabs, cadd, type Complex, ZERO } from './circuit';
import {
  measureCapacitance,
  measureOhmsInCircuit,
  measureOhmsIsolated,
  measureVolts,
} from './electrical';
import { type SimState, switchState } from './engine';
import { CLAMP_POINTS, type ClampPointId, type TestPointId, testPoint } from './testPoints';

export type MeterMode = 'vac' | 'ohm' | 'uf' | 'ua';

export type MeterReading =
  | { kind: 'idle' }
  | { kind: 'value'; value: number; unit: 'V' | 'Ω' | 'µF' | 'µA'; note?: string }
  | { kind: 'ol'; note?: string }
  | { kind: 'live'; volts: number }
  | { kind: 'na'; note: string };

/** Volts between two probe points right now. */
export function probeVolts(sim: SimState, a: TestPointId, b: TestPointId): number {
  return measureVolts(sim.unit, switchState(sim), testPoint(a).node, testPoint(b).node);
}

/** True when a non-contact tester held at this point would light up. */
export function isHot(sim: SimState, id: TestPointId): boolean {
  return cabs(sim.solution.v[testPoint(id).node]) > 50;
}

const LIVE_THRESHOLD = 3;

export function readMeter(
  sim: SimState,
  mode: MeterMode,
  red: TestPointId | null,
  black: TestPointId | null,
): MeterReading {
  if (red === null || black === null) return { kind: 'idle' };
  const a = testPoint(red);
  const b = testPoint(black);
  const volts = probeVolts(sim, red, black);

  if (mode === 'vac') return { kind: 'value', value: volts, unit: 'V' };
  if (mode === 'ua') return { kind: 'na', note: 'Microamps is for furnace flame sensors' };
  if (volts > LIVE_THRESHOLD) return { kind: 'live', volts };

  const samePart = a.part && b.part && a.part.component === b.part.component;

  if (mode === 'uf') {
    if (!samePart || a.part?.component !== 'capacitor' || !b.part) {
      return { kind: 'na', note: 'Put both leads on capacitor terminals' };
    }
    return {
      kind: 'value',
      value: measureCapacitance(sim.unit, a.part.pin, b.part.pin),
      unit: 'µF',
      note: 'leads pulled for test',
    };
  }

  let ohms: number;
  let note: string | undefined;
  if (samePart && a.part && b.part) {
    ohms = measureOhmsIsolated(sim.unit, switchState(sim), a.part.component, a.part.pin, b.part.pin);
    note = 'leads pulled for test';
  } else {
    ohms = measureOhmsInCircuit(sim.unit, switchState(sim), a.node, b.node);
    note = 'in circuit';
  }
  if (!Number.isFinite(ohms)) return { kind: 'ol', note };
  return { kind: 'value', value: ohms, unit: 'Ω', note };
}

/** Amps a clamp meter reads around a conductor. */
export function readClamp(sim: SimState, id: ClampPointId): number {
  const total = CLAMP_POINTS[id].elements.reduce<Complex>(
    (acc, el) => cadd(acc, sim.solution.i[el]),
    ZERO,
  );
  const amps = cabs(total);
  // A real clamp jitters a little on a running motor.
  return amps < 0.02 ? 0 : amps * (1 + 0.006 * Math.sin(sim.t * 5.3));
}
