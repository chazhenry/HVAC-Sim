import type { AnyClampId } from '../sim/points';
import type { TestPointId } from '../sim/testPoints';
import type { EquipmentContext } from '../api/types';

export type Vec3 = readonly [number, number, number];

/** Cabinet half-width, base height and top height (metres). */
export const HALF = 0.43;
export const BASE_Y = 0.1;
export const TOP_Y = 0.95;

export const COMPRESSOR_POS: Vec3 = [-0.1, 0, -0.08];
export const SUCTION_VALVE: Vec3 = [0.47, 0.32, 0.15];
export const LIQUID_VALVE: Vec3 = [0.47, 0.2, 0.15];
export const MANIFOLD_POS: Vec3 = [0.98, 0.1, 0.5];

/** Indoor cutaway behind the house wall, exposed beyond its right-hand edge. */
export function airHandlerPosition(context: EquipmentContext): Vec3 {
  return [context.dimensionsM.width / .86 + .45, .1, -.75 * context.dimensionsM.depth / .86 - .55];
}

export interface TestPointPlacement {
  pos: Vec3;
  /** Direction the probe sticks out of the terminal. */
  normal: 'front' | 'up';
}

export const TEST_POINT_PLACEMENT: Record<TestPointId, TestPointPlacement> = {
  HP_R: { pos: [0.185, 0.825, 0.34], normal: 'front' },
  HP_C: { pos: [0.225, 0.825, 0.34], normal: 'front' },
  HP_Y: { pos: [0.265, 0.825, 0.34], normal: 'front' },
  HP_O: { pos: [0.305, 0.825, 0.34], normal: 'front' },
  HP_W2: { pos: [0.345, 0.825, 0.34], normal: 'front' },
  CONT_L1: { pos: [0.21, 0.745, 0.326], normal: 'front' },
  CONT_L2: { pos: [0.26, 0.745, 0.326], normal: 'front' },
  CONT_T1: { pos: [0.21, 0.655, 0.326], normal: 'front' },
  CONT_T2: { pos: [0.26, 0.655, 0.326], normal: 'front' },
  COIL_A: { pos: [0.18, 0.7, 0.305], normal: 'front' },
  COIL_B: { pos: [0.29, 0.7, 0.305], normal: 'front' },
  LV_Y: { pos: [0.185, 0.52, 0.272], normal: 'front' },
  LV_SW: { pos: [0.185, 0.47, 0.272], normal: 'front' },
  CAP_C: { pos: [0.36, 0.44, 0.335], normal: 'up' },
  CAP_HERM: { pos: [0.335, 0.44, 0.3], normal: 'up' },
  CAP_FAN: { pos: [0.385, 0.44, 0.3], normal: 'up' },
  FAN_BLK: { pos: [0.33, 0.6, 0.288], normal: 'front' },
  FAN_PUR: { pos: [0.36, 0.6, 0.288], normal: 'front' },
  FAN_BRN: { pos: [0.39, 0.6, 0.288], normal: 'front' },
  GND_LUG: { pos: [0.395, 0.86, 0.264], normal: 'front' },

  COMP_C: { pos: [-0.1, 0.588, -0.105], normal: 'up' },
  COMP_S: { pos: [-0.127, 0.588, -0.06], normal: 'up' },
  COMP_R: { pos: [-0.073, 0.588, -0.06], normal: 'up' },

  DISC_L1_LINE: { pos: [0.95, 1.265, -0.632], normal: 'front' },
  DISC_L2_LINE: { pos: [1.05, 1.265, -0.632], normal: 'front' },
  DISC_L1_LOAD: { pos: [0.95, 1.04, -0.632], normal: 'front' },
  DISC_L2_LOAD: { pos: [1.05, 1.04, -0.632], normal: 'front' },
  DISC_GND: { pos: [1.088, 1.15, -0.636], normal: 'front' },
};

const p = (id: TestPointId): Vec3 => TEST_POINT_PLACEMENT[id].pos;

export interface WireDef {
  id: string;
  color: string;
  radius: number;
  points: readonly Vec3[];
  clamp?: AnyClampId;
}

const BLACK = '#1b1b1d';
const RED = '#b3261e';
const YELLOW = '#d9b300';
const PURPLE = '#6f3fa0';
const BROWN = '#6b4423';
const BLUE = '#2a5db0';
const HV = 0.0048;
const LV = 0.0026;

/** Control-box wiring. Each run is a spline through these points. */
export const WIRES: readonly WireDef[] = [
  {
    id: 'l1',
    color: BLACK,
    radius: HV,
    clamp: 'W_L1',
    points: [[0.4, 0.42, 0.4], [0.3, 0.2, 0.4], [0.175, 0.3, 0.37], [0.165, 0.7, 0.36], [0.185, 0.8, 0.345], p('CONT_L1')],
  },
  {
    id: 'l2',
    color: RED,
    radius: HV,
    clamp: 'W_L2',
    points: [[0.4, 0.45, 0.39], [0.33, 0.24, 0.39], [0.31, 0.5, 0.385], [0.305, 0.76, 0.37], [0.28, 0.8, 0.345], p('CONT_L2')],
  },
  {
    id: 'comp-c',
    color: BLACK,
    radius: HV,
    clamp: 'W_COMP_C',
    points: [p('CONT_T1'), [0.205, 0.6, 0.35], [0.2, 0.42, 0.33], [0.19, 0.22, 0.29], [0.17, 0.17, 0.26]],
  },
  {
    id: 'comp-r',
    color: RED,
    radius: HV,
    clamp: 'W_COMP_R',
    points: [p('CONT_T2'), [0.25, 0.59, 0.355], [0.235, 0.42, 0.335], [0.225, 0.22, 0.29], [0.21, 0.17, 0.26]],
  },
  {
    id: 'comp-s',
    color: YELLOW,
    radius: HV,
    clamp: 'W_COMP_S',
    points: [p('CAP_HERM'), [0.31, 0.48, 0.3], [0.275, 0.4, 0.31], [0.26, 0.22, 0.29], [0.25, 0.17, 0.26]],
  },
  {
    id: 't2-cap',
    color: RED,
    radius: HV,
    points: [p('CONT_T2'), [0.285, 0.62, 0.365], [0.335, 0.54, 0.37], [0.36, 0.49, 0.35], p('CAP_C')],
  },
  {
    id: 'fan-blk',
    color: BLACK,
    radius: HV,
    clamp: 'W_FAN_BLK',
    points: [p('CONT_T1'), [0.225, 0.625, 0.375], [0.29, 0.635, 0.36], p('FAN_BLK')],
  },
  {
    id: 'fan-pur',
    color: PURPLE,
    radius: HV,
    clamp: 'W_FAN_PUR',
    points: [p('CAP_C'), [0.375, 0.5, 0.36], [0.372, 0.56, 0.33], p('FAN_PUR')],
  },
  {
    id: 'fan-brn',
    color: BROWN,
    radius: HV,
    clamp: 'W_FAN_BRN',
    points: [p('CAP_FAN'), [0.408, 0.49, 0.31], [0.41, 0.56, 0.305], p('FAN_BRN')],
  },
  {
    id: 'fan-harness',
    color: '#2c2c2e',
    radius: 0.008,
    points: [[0.36, 0.615, 0.275], [0.36, 0.75, 0.27], [0.37, 0.905, 0.268]],
  },
  { id: 'lv-y', color: YELLOW, radius: LV, points: [[0.17, 0.16, 0.262], [0.172, 0.4, 0.268], p('LV_Y')] },
  { id: 'lv-hps', color: YELLOW, radius: LV, points: [p('LV_Y'), [0.158, 0.535, 0.28], [0.156, 0.3, 0.27], [0.158, 0.16, 0.262]] },
  { id: 'lv-lps', color: BLUE, radius: LV, points: [p('LV_SW'), [0.2, 0.44, 0.28], [0.205, 0.3, 0.27], [0.2, 0.16, 0.262]] },
  {
    id: 'lv-coil',
    color: YELLOW,
    radius: LV,
    clamp: 'W_COIL',
    points: [p('LV_SW'), [0.165, 0.5, 0.295], [0.16, 0.64, 0.3], p('COIL_A')],
  },
  { id: 'lv-c', color: BLUE, radius: LV, points: [p('COIL_B'), [0.315, 0.71, 0.29], [0.325, 0.4, 0.27], [0.3, 0.16, 0.262]] },
  { id: 'gnd', color: '#2e7d32', radius: HV, points: [p('GND_LUG'), [0.405, 0.7, 0.27], [0.415, 0.45, 0.3]] },
];

export interface View {
  label: string;
  camera: Vec3;
  target: Vec3;
}

/** Camera presets for the condenser. The first one is the starting view. */
export const VIEWS: readonly View[] = [
  { label: 'Whole unit', camera: [1.5, 1.25, 2.3], target: [0.2, 0.55, 0] },
  { label: 'Control box', camera: [0.42, 0.72, 1.12], target: [0.28, 0.56, 0.3] },
  { label: 'Top / compressor', camera: [-0.75, 1.75, 0.85], target: [-0.08, 0.45, -0.1] },
  { label: 'Disconnect', camera: [1.05, 1.25, 0.15], target: [1.0, 1.15, -0.65] },
  { label: 'Service valves', camera: [1.35, 0.55, 0.8], target: [0.55, 0.26, 0.15] },
];
export const HOME_VIEW: View = { label: 'Whole unit', camera: [1.5, 1.25, 2.3], target: [0.2, 0.55, 0] };

export function contextViews(context: EquipmentContext | null): readonly View[] {
  if (!context) return VIEWS;
  const d = context.dimensionsM;
  const scale = (v: Vec3): Vec3 => [v[0] * d.width / .86, v[1] * d.height / .85, v[2] * d.depth / .86];
  return VIEWS.map((view, index) => context.systemType === 'heat_pump' && index === 0
    ? { label: view.label, camera: scale([3.4, 1.8, 2.7]), target: scale([.65, .65, -.45]) }
    : { ...view, camera: scale(view.camera), target: scale(view.target) });
}
