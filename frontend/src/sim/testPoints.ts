import type { ComponentId, ElementId, NodeId } from './electrical';

/** Where a probe point lives - decides which panel has to be open to reach it. */
export type Enclosure = 'disconnect' | 'controlBox' | 'compressor';

export interface TestPointDef {
  label: string;
  short: string;
  node: NodeId;
  enclosure: Enclosure;
  /** Set when the point is a terminal of a part that can be tested in isolation. */
  part?: { component: ComponentId; pin: string };
}

const def = <T extends Record<string, TestPointDef>>(points: T): T => points;

export const TEST_POINTS = def({
  DISC_L1_LINE: { label: 'Disconnect L1 line lug', short: 'L1 line', node: 'L1_LINE', enclosure: 'disconnect' },
  DISC_L2_LINE: { label: 'Disconnect L2 line lug', short: 'L2 line', node: 'L2_LINE', enclosure: 'disconnect' },
  DISC_L1_LOAD: { label: 'Disconnect L1 load lug', short: 'L1 load', node: 'L1_LOAD', enclosure: 'disconnect' },
  DISC_L2_LOAD: { label: 'Disconnect L2 load lug', short: 'L2 load', node: 'L2_LOAD', enclosure: 'disconnect' },
  DISC_GND: { label: 'Disconnect ground bar', short: 'GND', node: 'GND', enclosure: 'disconnect' },

  CONT_L1: { label: 'Contactor L1 (line)', short: 'L1', node: 'L1_LOAD', enclosure: 'controlBox' },
  CONT_L2: { label: 'Contactor L2 (line)', short: 'L2', node: 'L2_LOAD', enclosure: 'controlBox' },
  CONT_T1: { label: 'Contactor T1 (load)', short: 'T1', node: 'T1', enclosure: 'controlBox' },
  CONT_T2: { label: 'Contactor T2 (load)', short: 'T2', node: 'T2', enclosure: 'controlBox' },
  COIL_A: {
    label: 'Contactor coil - Y side',
    short: 'Coil Y',
    node: 'COIL_Y',
    enclosure: 'controlBox',
    part: { component: 'coil', pin: 'A' },
  },
  COIL_B: {
    label: 'Contactor coil - C side',
    short: 'Coil C',
    node: 'LV_C',
    enclosure: 'controlBox',
    part: { component: 'coil', pin: 'B' },
  },
  LV_Y: { label: 'Low-voltage Y from thermostat', short: 'Y in', node: 'LV_Y', enclosure: 'controlBox' },
  LV_SW: {
    label: 'Between high- and low-pressure switches',
    short: 'HPS-LPS',
    node: 'LV_SW',
    enclosure: 'controlBox',
  },
  CAP_C: {
    label: 'Capacitor C (common)',
    short: 'C',
    node: 'T2',
    enclosure: 'controlBox',
    part: { component: 'capacitor', pin: 'C' },
  },
  CAP_HERM: {
    label: 'Capacitor HERM',
    short: 'HERM',
    node: 'COMP_S',
    enclosure: 'controlBox',
    part: { component: 'capacitor', pin: 'HERM' },
  },
  CAP_FAN: {
    label: 'Capacitor FAN',
    short: 'FAN',
    node: 'FAN_BRN',
    enclosure: 'controlBox',
    part: { component: 'capacitor', pin: 'FAN' },
  },
  FAN_BLK: {
    label: 'Fan motor black (common)',
    short: 'BLK',
    node: 'T1',
    enclosure: 'controlBox',
    part: { component: 'fan', pin: 'BLK' },
  },
  FAN_PUR: {
    label: 'Fan motor purple (run)',
    short: 'PUR',
    node: 'T2',
    enclosure: 'controlBox',
    part: { component: 'fan', pin: 'PUR' },
  },
  FAN_BRN: {
    label: 'Fan motor brown (capacitor)',
    short: 'BRN',
    node: 'FAN_BRN',
    enclosure: 'controlBox',
    part: { component: 'fan', pin: 'BRN' },
  },
  GND_LUG: { label: 'Chassis ground lug', short: 'GND', node: 'GND', enclosure: 'controlBox' },

  COMP_C: {
    label: 'Compressor C (common)',
    short: 'C',
    node: 'T1',
    enclosure: 'compressor',
    part: { component: 'compressor', pin: 'C' },
  },
  COMP_S: {
    label: 'Compressor S (start)',
    short: 'S',
    node: 'COMP_S',
    enclosure: 'compressor',
    part: { component: 'compressor', pin: 'S' },
  },
  COMP_R: {
    label: 'Compressor R (run)',
    short: 'R',
    node: 'T2',
    enclosure: 'compressor',
    part: { component: 'compressor', pin: 'R' },
  },
});

export type TestPointId = keyof typeof TEST_POINTS;
export const testPoint = (id: TestPointId): TestPointDef => TEST_POINTS[id];

export interface ClampPointDef {
  label: string;
  /** Elements whose currents add up to the current in this conductor. */
  elements: readonly ElementId[];
}

export const CLAMP_POINTS = {
  W_L1: { label: 'L1 supply', elements: ['POLE1'] },
  W_L2: { label: 'L2 supply', elements: ['POLE2'] },
  W_COMP_C: { label: 'Compressor common', elements: ['OVERLOAD'] },
  W_COMP_R: { label: 'Compressor run', elements: ['COMP_RUN'] },
  W_COMP_S: { label: 'Compressor start', elements: ['COMP_START'] },
  W_FAN_BLK: { label: 'Fan black (common)', elements: ['FAN_RUN', 'FAN_AUX'] },
  W_FAN_PUR: { label: 'Fan purple (run)', elements: ['FAN_RUN'] },
  W_FAN_BRN: { label: 'Fan brown (capacitor)', elements: ['FAN_AUX'] },
  W_COIL: { label: 'Contactor coil 24 V', elements: ['COIL'] },
} as const satisfies Record<string, ClampPointDef>;

export type ClampPointId = keyof typeof CLAMP_POINTS;
