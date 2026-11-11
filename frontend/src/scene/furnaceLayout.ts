import type { FTestPointId } from '../sim/furnace/testPoints';
import type { TestPointPlacement, Vec3, View } from './layout';

/** Cabinet: 0.45 wide, 1.0 tall, 0.7 deep; front face at +z. */
export const F_HALF_W = 0.225;
export const F_HALF_D = 0.35;
export const F_HEIGHT = 1.0;
/** Deck between the blower compartment (below) and burner compartment (above). */
export const F_DECK_Y = 0.45;
/** Front plate of the heat exchanger, back wall of the burner vestibule. */
export const F_HX_Z = 0.05;

export const BURNER_X: readonly number[] = [-0.15, -0.06, 0.03];
export const BURNER_Y = 0.53;
export const GAS_VALVE: Vec3 = [0.15, 0.55, 0.27];
export const INDUCER: Vec3 = [0.02, 0.8, 0.11];
export const PRESSURE_SWITCH: Vec3 = [-0.15, 0.87, 0.075];
export const LIMIT_SWITCH: Vec3 = [0.16, 0.7, 0.06];
export const BOARD: Vec3 = [-0.09, 0.33, 0.2];
export const BLOWER: Vec3 = [0, 0.19, -0.06];
export const BLOWER_CAP: Vec3 = [0.165, 0.14, 0.22];
export const DOOR_SWITCH: Vec3 = [0.195, 0.415, 0.31];
export const SWITCH_BOX: Vec3 = [0.257, 0.9, 0.04];
export const GAS_COCK: Vec3 = [0.36, 0.55, 0.27];

export const F_TEST_POINT_PLACEMENT: Record<FTestPointId, TestPointPlacement> = {
  F_SW_LINE: { pos: [0.245, 0.94, 0.083], normal: 'front' },
  F_SW_N: { pos: [0.272, 0.94, 0.083], normal: 'front' },
  F_SW_LOAD: { pos: [0.245, 0.86, 0.083], normal: 'front' },
  F_SW_GND: { pos: [0.272, 0.86, 0.083], normal: 'front' },

  F_DS_IN: { pos: [0.18, 0.39, 0.318], normal: 'front' },
  F_DS_OUT: { pos: [0.208, 0.39, 0.318], normal: 'front' },
  F_BD_L1: { pos: [-0.17, 0.385, 0.21], normal: 'front' },
  F_BD_N: { pos: [-0.14, 0.385, 0.21], normal: 'front' },
  F_BD_SEC: { pos: [-0.1, 0.385, 0.21], normal: 'front' },
  F_BD_R: { pos: [-0.17, 0.275, 0.21], normal: 'front' },
  F_BD_C: { pos: [-0.14, 0.275, 0.21], normal: 'front' },
  F_BD_W: { pos: [-0.11, 0.275, 0.21], normal: 'front' },
  F_BD_FS: { pos: [-0.02, 0.275, 0.21], normal: 'front' },
  F_BLW_H: { pos: [0.05, 0.3, 0.215], normal: 'front' },
  F_BLW_N: { pos: [0.08, 0.3, 0.215], normal: 'front' },
  F_BCAP_A: { pos: [0.152, 0.187, 0.22], normal: 'up' },
  F_BCAP_B: { pos: [0.178, 0.187, 0.22], normal: 'up' },

  F_IND_H: { pos: [0.005, 0.856, 0.22], normal: 'up' },
  F_IND_N: { pos: [0.035, 0.856, 0.22], normal: 'up' },
  F_IGN_H: { pos: [-0.2, 0.63, 0.135], normal: 'front' },
  F_IGN_N: { pos: [-0.172, 0.63, 0.135], normal: 'front' },
  F_GV_MV: { pos: [0.135, 0.602, 0.285], normal: 'up' },
  F_GV_C: { pos: [0.165, 0.602, 0.285], normal: 'up' },
  F_PS_A: { pos: [-0.165, 0.87, 0.098], normal: 'front' },
  F_PS_B: { pos: [-0.135, 0.87, 0.098], normal: 'front' },
  F_LIM_A: { pos: [0.146, 0.7, 0.08], normal: 'front' },
  F_LIM_B: { pos: [0.174, 0.7, 0.08], normal: 'front' },
  F_FS_ROD: { pos: [0.085, 0.6, 0.115], normal: 'front' },
};

export const F_VIEWS: readonly View[] = [
  { label: 'Whole furnace', camera: [1.25, 1.2, 2.5], target: [0.02, 0.75, 0] },
  { label: 'Burner compartment', camera: [0.06, 0.86, 1.2], target: [0, 0.72, 0.15] },
  { label: 'Blower compartment', camera: [0.06, 0.42, 1.15], target: [0, 0.26, 0.15] },
  { label: 'Gas & power side', camera: [1.25, 0.95, 1.0], target: [0.28, 0.72, 0.15] },
  { label: 'Filter & return', camera: [-1.3, 0.7, 1.5], target: [-0.3, 0.35, 0.1] },
];
