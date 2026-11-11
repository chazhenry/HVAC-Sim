import type { FElementId, FNodeId, FPart } from './electrical';

export type FEnclosure = 'burner' | 'blower' | 'switchBox';

export interface FTestPointDef {
  label: string;
  short: string;
  node: FNodeId;
  enclosure: FEnclosure;
  /** Set when the point is one end of a part that is tested with its leads pulled. */
  part?: FPart;
}

const def = <T extends Record<string, FTestPointDef>>(points: T): T => points;

export const F_TEST_POINTS = def({
  F_SW_LINE: { label: 'Service switch - line side', short: 'LINE', node: 'L1', enclosure: 'switchBox' },
  F_SW_LOAD: { label: 'Service switch - load side', short: 'LOAD', node: 'L1_SW', enclosure: 'switchBox' },
  F_SW_N: { label: 'Neutral', short: 'N', node: 'N', enclosure: 'switchBox' },
  F_SW_GND: { label: 'Ground', short: 'GND', node: 'GND', enclosure: 'switchBox' },

  F_DS_IN: { label: 'Door switch - line side', short: 'DS in', node: 'L1_SW', enclosure: 'blower' },
  F_DS_OUT: { label: 'Door switch - load side', short: 'DS out', node: 'L1_BD', enclosure: 'blower' },
  F_BD_L1: { label: 'Board L1 (120 V in)', short: 'L1', node: 'L1_BD', enclosure: 'blower' },
  F_BD_N: { label: 'Board neutral', short: 'N', node: 'N', enclosure: 'blower' },
  F_BD_SEC: { label: 'Board 24 V from transformer', short: '24V', node: 'SEC', enclosure: 'blower' },
  F_BD_R: { label: 'Board R (fused 24 V to thermostat)', short: 'R', node: 'R', enclosure: 'blower' },
  F_BD_C: { label: 'Board C (24 V common)', short: 'C', node: 'C', enclosure: 'blower' },
  F_BD_W: { label: 'Board W (heat call)', short: 'W', node: 'W', enclosure: 'blower' },
  F_BD_FS: { label: 'Board FS (flame sense)', short: 'FS', node: 'FS', enclosure: 'blower' },
  F_BLW_H: { label: 'Blower motor - heat speed lead', short: 'BLW', node: 'BLW', enclosure: 'blower', part: 'blowerMotor' },
  F_BLW_N: { label: 'Blower motor - neutral lead', short: 'BLW N', node: 'N', enclosure: 'blower', part: 'blowerMotor' },
  F_BCAP_A: { label: 'Blower capacitor terminal 1', short: 'CAP', node: 'BLW_CAP', enclosure: 'blower', part: 'blowerCap' },
  F_BCAP_B: { label: 'Blower capacitor terminal 2', short: 'CAP', node: 'N', enclosure: 'blower', part: 'blowerCap' },

  F_IND_H: { label: 'Inducer motor - hot lead', short: 'IND', node: 'IND', enclosure: 'burner', part: 'inducer' },
  F_IND_N: { label: 'Inducer motor - neutral lead', short: 'IND N', node: 'N', enclosure: 'burner', part: 'inducer' },
  F_IGN_H: { label: 'Igniter plug - hot', short: 'IGN', node: 'IGN', enclosure: 'burner', part: 'igniter' },
  F_IGN_N: { label: 'Igniter plug - neutral', short: 'IGN N', node: 'N', enclosure: 'burner', part: 'igniter' },
  F_GV_MV: { label: 'Gas valve MV', short: 'MV', node: 'MV', enclosure: 'burner', part: 'gasValve' },
  F_GV_C: { label: 'Gas valve C', short: 'C', node: 'C', enclosure: 'burner', part: 'gasValve' },
  F_PS_A: { label: 'Pressure switch - 24 V side', short: 'PS in', node: 'SEC', enclosure: 'burner', part: 'pressureSwitch' },
  F_PS_B: { label: 'Pressure switch - board side', short: 'PS out', node: 'PS_IN', enclosure: 'burner', part: 'pressureSwitch' },
  F_LIM_A: { label: 'High limit - 24 V side', short: 'LIM in', node: 'SEC', enclosure: 'burner', part: 'limit' },
  F_LIM_B: { label: 'High limit - board side', short: 'LIM out', node: 'LIM_IN', enclosure: 'burner', part: 'limit' },
  F_FS_ROD: { label: 'Flame sensor terminal', short: 'FS', node: 'FS', enclosure: 'burner' },
});

export type FTestPointId = keyof typeof F_TEST_POINTS;

export const F_CLAMP_POINTS = {
  F_W_L1: { label: 'Furnace 120 V supply', elements: ['DOOR'] },
  F_W_IND: { label: 'Inducer motor', elements: ['INDUCER'] },
  F_W_IGN: { label: 'Igniter', elements: ['IGNITER'] },
  F_W_BLW: { label: 'Blower motor', elements: ['BLW_RUN', 'BLW_AUX'] },
  F_W_GV: { label: 'Gas valve 24 V', elements: ['GAS_COIL'] },
} as const satisfies Record<string, { label: string; elements: readonly FElementId[] }>;

export type FClampPointId = keyof typeof F_CLAMP_POINTS;
