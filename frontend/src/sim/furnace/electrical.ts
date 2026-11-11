import type { FurnaceParams } from '../../api/types';
import { type Branch, type Complex, cabs, cdiv, cinv, csub, cx, solveNetwork, ZERO } from '../circuit';
import type { MotorState } from '../electrical';

/**
 * Electrical nodes of the furnace.
 *
 *   L1 --[service switch]-- L1_SW --[door switch]-- L1_BD (board line in)
 *   L1_BD --[inducer relay]-- IND --[inducer motor]-- N
 *   L1_BD --[igniter relay]-- IGN --[hot-surface igniter]-- N
 *   L1_BD --[blower relay]-- BLW --[run winding]-- N
 *                            BLW --[aux winding]-- BLW_CAP --[run capacitor]-- N
 *   L1_BD --[transformer primary]-- N        (secondary: SEC = 24 V, C = common)
 *
 *   SEC --[3 A fuse]-- R --[thermostat]-- W --(board input)-- C
 *   SEC --[high limit]-- LIM_IN --[gas relay]-- MV --[gas valve coil]-- C
 *   SEC --[pressure switch]-- PS_IN --(board input)-- C
 *
 * FS is the flame-sense lead; it carries microamps of DC and is not part of the AC network.
 */
export const F_NODES = [
  'GND',
  'L1',
  'N',
  'C',
  'L1_SW',
  'L1_BD',
  'SEC',
  'R',
  'W',
  'LIM_IN',
  'PS_IN',
  'MV',
  'IND',
  'IGN',
  'BLW',
  'BLW_CAP',
  'FS',
] as const;
export type FNodeId = (typeof F_NODES)[number];

export type FElementId =
  | 'SERVICE'
  | 'DOOR'
  | 'XFMR_PRI'
  | 'XFMR_SEC'
  | 'FUSE'
  | 'TSTAT'
  | 'W_SENSE'
  | 'LIMIT'
  | 'LIM_SENSE'
  | 'PSWITCH'
  | 'PS_SENSE'
  | 'GAS_RELAY'
  | 'GAS_COIL'
  | 'IND_RELAY'
  | 'INDUCER'
  | 'IGN_RELAY'
  | 'IGNITER'
  | 'BLW_RELAY'
  | 'BLW_RUN'
  | 'BLW_AUX'
  | 'BLW_CAP'
  | 'BOND_N'
  | 'BOND_C';

export interface Relays {
  inducer: boolean;
  igniter: boolean;
  gas: boolean;
  blower: boolean;
}

export interface FSwitchState {
  powerOn: boolean;
  doorClosed: boolean;
  calling: boolean;
  limitOpen: boolean;
  psClosed: boolean;
  relays: Relays;
  inducerTurning: boolean;
  /** 0 = cold, 1 = glowing. */
  igniterTemp: number;
  blower: MotorState;
}

interface Element {
  id: FElementId;
  a: FNodeId;
  b: FNodeId;
  z: Complex | null;
  rdc: number | null;
}

const OMEGA = 2 * Math.PI * 60;
const CLOSED = 0.01;
const SENSE = 2000;
const METER_SIEMENS = 1e-7;
export const LINE_VOLTS = 120;

const sw = (isClosed: boolean): { z: Complex | null; rdc: number | null } =>
  isClosed ? { z: cx(CLOSED), rdc: CLOSED } : { z: null, rdc: null };
const load = (ohms: number | null, z: Complex): { z: Complex | null; rdc: number | null } =>
  ohms === null ? { z: null, rdc: null } : { z, rdc: ohms };

export function buildFElements(unit: FurnaceParams, s: FSwitchState): Element[] {
  const capUf = unit.blowerCapUf;
  const turning = s.blower === 'running';
  // Silicon-carbide igniters drop in resistance as they heat.
  const igniterZ = cx((unit.igniterOhms ?? 55) * (1 - 0.5 * s.igniterTemp));
  return [
    { id: 'SERVICE', a: 'L1', b: 'L1_SW', ...sw(s.powerOn) },
    { id: 'DOOR', a: 'L1_SW', b: 'L1_BD', ...sw(s.doorClosed) },
    { id: 'XFMR_PRI', a: 'L1_BD', b: 'N', z: cx(300, 400), rdc: 18 },
    { id: 'XFMR_SEC', a: 'SEC', b: 'C', z: null, rdc: 0.8 },
    { id: 'FUSE', a: 'SEC', b: 'R', ...sw(unit.fuseOk) },
    { id: 'TSTAT', a: 'R', b: 'W', ...sw(s.calling) },
    { id: 'W_SENSE', a: 'W', b: 'C', z: cx(SENSE), rdc: SENSE },
    { id: 'LIMIT', a: 'SEC', b: 'LIM_IN', ...sw(!s.limitOpen && unit.limitOk) },
    { id: 'LIM_SENSE', a: 'LIM_IN', b: 'C', z: cx(SENSE), rdc: SENSE },
    { id: 'PSWITCH', a: 'SEC', b: 'PS_IN', ...sw(s.psClosed) },
    { id: 'PS_SENSE', a: 'PS_IN', b: 'C', z: cx(SENSE), rdc: SENSE },
    { id: 'GAS_RELAY', a: 'LIM_IN', b: 'MV', ...sw(s.relays.gas) },
    { id: 'GAS_COIL', a: 'MV', b: 'C', ...load(unit.gasValveCoilOhms, cx(unit.gasValveCoilOhms ?? 48, 36)) },
    { id: 'IND_RELAY', a: 'L1_BD', b: 'IND', ...sw(s.relays.inducer) },
    { id: 'INDUCER', a: 'IND', b: 'N', ...load(unit.inducerOhms, s.inducerTurning ? cx(80, 60) : cx(40, 30)) },
    { id: 'IGN_RELAY', a: 'L1_BD', b: 'IGN', ...sw(s.relays.igniter) },
    { id: 'IGNITER', a: 'IGN', b: 'N', ...load(unit.igniterOhms, igniterZ) },
    { id: 'BLW_RELAY', a: 'L1_BD', b: 'BLW', ...sw(s.relays.blower) },
    { id: 'BLW_RUN', a: 'BLW', b: 'N', ...load(unit.blowerRunOhms, turning ? cx(17.5, 13) : cx(6, 8)) },
    { id: 'BLW_AUX', a: 'BLW', b: 'BLW_CAP', ...load(unit.blowerAuxOhms, turning ? cx(40, 60) : cx(15, 20)) },
    {
      id: 'BLW_CAP',
      a: 'BLW_CAP',
      b: 'N',
      z: capUf > 0.05 ? cx(0, -1 / (OMEGA * capUf * 1e-6)) : null,
      rdc: null,
    },
    // Neutral and 24 V common are bonded to ground; only matters to the ohmmeter.
    { id: 'BOND_N', a: 'N', b: 'GND', z: null, rdc: 0.05 },
    { id: 'BOND_C', a: 'C', b: 'GND', z: null, rdc: 0.05 },
  ];
}

export interface FSolution {
  v: Record<FNodeId, Complex>;
  i: Record<FElementId, Complex>;
}

export function solveFurnace(
  unit: FurnaceParams,
  s: FSwitchState,
  meter?: readonly [FNodeId, FNodeId],
): FSolution {
  const elements = buildFElements(unit, s);
  const branches: Branch<FNodeId>[] = [];
  for (const e of elements) if (e.z !== null) branches.push({ a: e.a, b: e.b, y: cinv(e.z) });
  if (meter) branches.push({ a: meter[0], b: meter[1], y: cx(METER_SIEMENS) });

  const fixed = (sec: number): Partial<Record<FNodeId, Complex>> => ({
    GND: ZERO,
    N: ZERO,
    C: ZERO,
    L1: cx(LINE_VOLTS),
    SEC: cx(sec),
  });
  // The transformer secondary follows whatever reaches the primary, so solve twice.
  const first = solveNetwork({ nodes: F_NODES, fixed: fixed(0), branches });
  const secondary = (24 * cabs(first.L1_BD)) / LINE_VOLTS;
  const v = solveNetwork({ nodes: F_NODES, fixed: fixed(secondary), branches });

  const i = {} as Record<FElementId, Complex>;
  for (const e of elements) i[e.id] = e.z === null ? ZERO : cdiv(csub(v[e.a], v[e.b]), e.z);
  return { v, i };
}

export function fMeasureVolts(unit: FurnaceParams, s: FSwitchState, a: FNodeId, b: FNodeId): number {
  if (a === b) return 0;
  const { v } = solveFurnace(unit, s, [a, b]);
  return cabs(csub(v[a], v[b]));
}

export function fMeasureOhmsInCircuit(unit: FurnaceParams, s: FSwitchState, a: FNodeId, b: FNodeId): number {
  if (a === b) return 0;
  const branches: Branch<FNodeId>[] = [];
  for (const e of buildFElements(unit, s)) {
    if (e.rdc !== null) branches.push({ a: e.a, b: e.b, y: cx(1 / Math.max(e.rdc, 1e-3)) });
  }
  const v = solveNetwork({
    nodes: F_NODES,
    fixed: { GND: ZERO },
    branches,
    inject: { [a]: cx(1), [b]: cx(-1) } as Partial<Record<FNodeId, Complex>>,
  });
  const ohms = Math.abs(v[a].re - v[b].re);
  return ohms > 2e6 ? Infinity : ohms;
}

/** Two-terminal parts that are ohmed with their leads pulled. */
export type FPart =
  | 'inducer'
  | 'igniter'
  | 'gasValve'
  | 'pressureSwitch'
  | 'limit'
  | 'blowerMotor'
  | 'blowerCap';

export function fMeasureOhmsIsolated(unit: FurnaceParams, s: FSwitchState, part: FPart): number {
  switch (part) {
    case 'inducer':
      return unit.inducerOhms ?? Infinity;
    case 'igniter':
      return unit.igniterOhms ?? Infinity;
    case 'gasValve':
      return unit.gasValveCoilOhms ?? Infinity;
    case 'pressureSwitch':
      return s.psClosed ? 0.1 : Infinity;
    case 'limit':
      return !s.limitOpen && unit.limitOk ? 0.1 : Infinity;
    case 'blowerMotor':
      return unit.blowerRunOhms ?? Infinity;
    case 'blowerCap':
      return Infinity;
  }
}
