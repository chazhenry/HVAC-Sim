import type { UnitParams } from '../api/types';
import type { HeatPumpState } from './heatPump';
import { type Branch, type Complex, cabs, cdiv, cinv, csub, cx, solveNetwork, ZERO } from './circuit';

/**
 * Electrical nodes of the condensing unit.
 *
 *   L1_LINE --[disconnect+fuse]-- L1_LOAD --[contactor pole 1]-- T1
 *   L2_LINE --[disconnect+fuse]-- L2_LOAD --[contactor pole 2]-- T2
 *
 *   T1 --[internal overload]-- COMP_INT --[run winding]-- T2
 *                              COMP_INT --[start winding]-- COMP_S --[cap HERM]-- T2
 *   T1 --[fan run winding]-- T2
 *   T1 --[fan aux winding]-- FAN_BRN --[cap FAN]-- T2
 *
 *   LV_R --[thermostat]-- LV_Y --[HPS]-- LV_SW --[LPS]-- COIL_Y --[contactor coil]-- LV_C
 */
export const NODES = [
  'GND',
  'L1_LINE',
  'L2_LINE',
  'L1_LOAD',
  'L2_LOAD',
  'T1',
  'T2',
  'COMP_INT',
  'COMP_S',
  'FAN_BRN',
  'LV_R',
  'LV_Y',
  'LV_SW',
  'COIL_Y',
  'LV_C',
  'HP_IN', 'HP_O', 'HP_W2',
] as const;
export type NodeId = (typeof NODES)[number];

export type ElementId =
  | 'HP_BOARD' | 'HP_RV' | 'HP_AUX'
  | 'DISC_L1'
  | 'DISC_L2'
  | 'POLE1'
  | 'POLE2'
  | 'TSTAT'
  | 'HPS'
  | 'LPS'
  | 'COIL'
  | 'OVERLOAD'
  | 'COMP_RUN'
  | 'COMP_START'
  | 'CAP_HERM'
  | 'FAN_RUN'
  | 'FAN_AUX'
  | 'CAP_FAN';

export type MotorState = 'off' | 'running' | 'locked';

/** Everything that decides which paths conduct and how hard the motors pull. */
export interface SwitchState {
  disconnectIn: boolean;
  calling: boolean;
  contactorIn: boolean;
  hpsOpen: boolean;
  lpsOpen: boolean;
  overloadOpen: boolean;
  compressor: MotorState;
  fan: MotorState;
  /** Run-winding current the compressor draws at its present load (A). */
  compressorLoadAmps: number;
  lineVolts?: number;
  singlePole?: boolean;
  heatPump?: HeatPumpState;
}

interface Element {
  id: ElementId;
  a: NodeId;
  b: NodeId;
  /** AC impedance at 60 Hz; null = open circuit. */
  z: Complex | null;
  /** DC resistance for the ohmmeter; null = open circuit. */
  rdc: number | null;
}

const LINE_VOLTS = 240;
const OMEGA = 2 * Math.PI * 60;
const CLOSED = 0.01;
const METER_SIEMENS = 1e-7; // 10 Mohm input impedance

const closed = (isClosed: boolean): { z: Complex | null; rdc: number | null } =>
  isClosed ? { z: cx(CLOSED), rdc: CLOSED } : { z: null, rdc: null };

const capacitorZ = (uf: number): Complex | null =>
  uf > 0.05 ? cx(0, -1 / (OMEGA * uf * 1e-6)) : null;

export function buildElements(unit: UnitParams, s: SwitchState): Element[] {
  const { contactor, capacitor, compressor, fanMotor } = unit;

  const pole = (ohms: number | null): { z: Complex | null; rdc: number | null } =>
    s.contactorIn && ohms !== null ? { z: cx(ohms), rdc: ohms } : { z: null, rdc: null };

  // Compressor windings: effective impedance depends on whether the rotor turns.
  let compRunZ: Complex;
  let compStartZ: Complex;
  if (s.compressor === 'running') {
    const mag = LINE_VOLTS / Math.max(s.compressorLoadAmps, 1);
    compRunZ = cx(mag * 0.85, mag * 0.527);
    compStartZ = cx(12, 18);
  } else {
    const mag = LINE_VOLTS / compressor.lra;
    compRunZ = cx(mag * 0.5, mag * 0.866);
    compStartZ = cx(4, 6);
  }

  const fanRunZ = s.fan === 'running' ? cx(192, 144) : cx(60, 50);
  const fanAuxZ = s.fan === 'running' ? cx(150, 160) : cx(80, 60);

  return [
    { id: 'DISC_L1', a: 'L1_LINE', b: 'L1_LOAD', ...closed(s.disconnectIn && unit.fuseL1Ok) },
    { id: 'DISC_L2', a: 'L2_LINE', b: 'L2_LOAD', ...closed(s.disconnectIn && unit.fuseL2Ok) },
    { id: 'POLE1', a: 'L1_LOAD', b: 'T1', ...pole(contactor.pole1Ohms) },
    { id: 'POLE2', a: 'L2_LOAD', b: 'T2', ...(s.singlePole ? closed(true) : pole(contactor.pole2Ohms)) },
    { id: 'TSTAT', a: 'LV_R', b: 'LV_Y', ...closed(s.calling) },
    { id: 'HPS', a: 'LV_Y', b: 'LV_SW', ...closed(!s.hpsOpen) },
    { id: 'LPS', a: 'LV_SW', b: s.heatPump ? 'HP_IN' : 'COIL_Y', ...closed(!s.lpsOpen) },
    { id: 'HP_BOARD', a: 'HP_IN', b: 'COIL_Y', ...closed(!!s.heatPump?.compressorPermitted) },
    { id: 'HP_RV', a: 'HP_O', b: 'LV_C', z: s.heatPump ? cx(48, 15) : null, rdc: s.heatPump ? 48 : null },
    { id: 'HP_AUX', a: 'HP_W2', b: 'LV_C', z: s.heatPump ? cx(120) : null, rdc: s.heatPump ? 120 : null },
    {
      id: 'COIL',
      a: 'COIL_Y',
      b: 'LV_C',
      z: contactor.coilOhms === null ? null : cx(contactor.coilOhms, 75),
      rdc: contactor.coilOhms,
    },
    { id: 'OVERLOAD', a: 'T1', b: 'COMP_INT', ...closed(!s.overloadOpen) },
    {
      id: 'COMP_RUN',
      a: 'COMP_INT',
      b: 'T2',
      z: compressor.runOhms === null ? null : compRunZ,
      rdc: compressor.runOhms,
    },
    {
      id: 'COMP_START',
      a: 'COMP_INT',
      b: 'COMP_S',
      z: compressor.startOhms === null ? null : compStartZ,
      rdc: compressor.startOhms,
    },
    { id: 'CAP_HERM', a: 'COMP_S', b: 'T2', z: capacitorZ(capacitor.hermUf), rdc: null },
    {
      id: 'FAN_RUN',
      a: 'T1',
      b: 'T2',
      z: fanMotor.runOhms === null || s.heatPump?.fanPermitted === false ? null : fanRunZ,
      rdc: fanMotor.runOhms,
    },
    {
      id: 'FAN_AUX',
      a: 'T1',
      b: 'FAN_BRN',
      z: fanMotor.auxOhms === null || s.heatPump?.fanPermitted === false ? null : fanAuxZ,
      rdc: fanMotor.auxOhms,
    },
    { id: 'CAP_FAN', a: 'FAN_BRN', b: 'T2', z: capacitorZ(capacitor.fanUf), rdc: null },
  ];
}

export interface AcSolution {
  /** Node potentials relative to ground (volts, phasor). */
  v: Record<NodeId, Complex>;
  /** Current through each element, a -> b (amps, phasor). */
  i: Record<ElementId, Complex>;
}

const SOURCES: Partial<Record<NodeId, Complex>> = {
  GND: ZERO,
  L1_LINE: cx(LINE_VOLTS / 2),
  L2_LINE: cx(-LINE_VOLTS / 2),
  LV_R: cx(24),
  LV_C: ZERO,
};

/** Solve the live circuit. `meter` adds a voltmeter's input impedance between two nodes. */
export function solveAc(
  unit: UnitParams,
  s: SwitchState,
  meter?: readonly [NodeId, NodeId],
): AcSolution {
  const elements = buildElements(unit, s);
  const branches: Branch<NodeId>[] = [];
  for (const e of elements) if (e.z !== null) branches.push({ a: e.a, b: e.b, y: cinv(e.z) });
  if (meter) branches.push({ a: meter[0], b: meter[1], y: cx(METER_SIEMENS) });

  const fixed: Partial<Record<NodeId, Complex>> = { ...SOURCES,
    L1_LINE: cx((s.lineVolts ?? LINE_VOLTS) / 2), L2_LINE: cx(-(s.lineVolts ?? LINE_VOLTS) / 2),
    HP_O: cx(s.heatPump?.reversingValveEnergized ? 24 : 0), HP_W2: cx(s.heatPump?.auxiliaryHeat ? 24 : 0),
    ...(!s.heatPump ? { HP_IN: ZERO } : {}),
  };
  const v = solveNetwork({ nodes: NODES, fixed, branches });
  const i = {} as Record<ElementId, Complex>;
  for (const e of elements) i[e.id] = e.z === null ? ZERO : cdiv(csub(v[e.a], v[e.b]), e.z);
  return { v, i };
}

/** AC volts a meter would display between two nodes. */
export function measureVolts(unit: UnitParams, s: SwitchState, a: NodeId, b: NodeId): number {
  if (a === b) return 0;
  const { v } = solveAc(unit, s, [a, b]);
  return cabs(csub(v[a], v[b]));
}

/** In-circuit DC resistance between two nodes with all sources removed. Infinity = open. */
export function measureOhmsInCircuit(
  unit: UnitParams,
  s: SwitchState,
  a: NodeId,
  b: NodeId,
): number {
  if (a === b) return 0;
  const branches: Branch<NodeId>[] = [];
  for (const e of buildElements(unit, s)) {
    if (e.rdc !== null) branches.push({ a: e.a, b: e.b, y: cx(1 / Math.max(e.rdc, 1e-3)) });
  }
  const v = solveNetwork({
    nodes: NODES,
    fixed: { GND: ZERO },
    branches,
    inject: { [a]: cx(1), [b]: cx(-1) } as Partial<Record<NodeId, Complex>>,
  });
  const ohms = Math.abs(v[a].re - v[b].re);
  return ohms > 2e6 ? Infinity : ohms;
}

export type ComponentId = 'compressor' | 'fan' | 'capacitor' | 'coil';

const sum = (...parts: Array<number | null>): number =>
  parts.reduce<number>((acc, p) => (p === null ? Infinity : acc + p), 0);

const pair = (a: string, b: string, x: string, y: string): boolean =>
  (a === x && b === y) || (a === y && b === x);

/**
 * Resistance of a single component measured across two of its own terminals,
 * as if its leads had been pulled so nothing else is in parallel.
 */
export function measureOhmsIsolated(
  unit: UnitParams,
  s: SwitchState,
  component: ComponentId,
  pinA: string,
  pinB: string,
): number {
  if (pinA === pinB) return 0;
  switch (component) {
    case 'compressor': {
      const { runOhms, startOhms } = unit.compressor;
      const overload = s.overloadOpen ? null : 0;
      if (pair(pinA, pinB, 'C', 'R')) return sum(overload, runOhms);
      if (pair(pinA, pinB, 'C', 'S')) return sum(overload, startOhms);
      return sum(runOhms, startOhms);
    }
    case 'fan': {
      const { runOhms, auxOhms } = unit.fanMotor;
      if (pair(pinA, pinB, 'BLK', 'PUR')) return sum(runOhms);
      if (pair(pinA, pinB, 'BLK', 'BRN')) return sum(auxOhms);
      return sum(runOhms, auxOhms);
    }
    case 'coil':
      return sum(unit.contactor.coilOhms);
    case 'capacitor':
      return Infinity; // a healthy capacitor charges up and reads open
  }
}

/** Capacitance between two capacitor terminals in microfarads. */
export function measureCapacitance(unit: UnitParams, pinA: string, pinB: string): number {
  const { hermUf, fanUf } = unit.capacitor;
  if (pinA === pinB) return 0;
  if (pair(pinA, pinB, 'C', 'HERM')) return hermUf;
  if (pair(pinA, pinB, 'C', 'FAN')) return fanUf;
  return hermUf + fanUf > 0 ? (hermUf * fanUf) / (hermUf + fanUf) : 0;
}
