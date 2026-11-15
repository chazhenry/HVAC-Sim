/**
 * Wires the clamp meter cannot usefully read, keyed by wire id (scene/layout.ts WIRES and the
 * furnace's F_WIRES). Clicking one with the clamp shows a red ✕ on the meter and a terse toast:
 * what was clicked, why it is no help, and what to clamp instead.
 */
export const CLAMP_NOTES: Readonly<Record<string, { name: string; why: string }>> = {
  gnd: {
    name: 'Ground wire',
    why: 'carries no current unless there is a fault. Clamp L1, L2 or a load lead.',
  },
  't2-cap': {
    name: 'T2-to-capacitor jumper',
    why: 'carries compressor and fan current together, so it cannot isolate either. Clamp a single load lead.',
  },
  'fan-harness': {
    name: 'Fan motor harness',
    why: 'the bundled leads cancel each other out. Clamp one fan lead: black, purple or brown.',
  },
  'lv-y': {
    name: '24 V thermostat (Y) wire',
    why: 'control current is too small to read here. Clamp the contactor coil lead or a line/load wire.',
  },
  'lv-hps': {
    name: '24 V high-pressure switch wire',
    why: 'a safety-circuit signal, too little current to read. Check it with the multimeter for voltage.',
  },
  'lv-lps': {
    name: '24 V low-pressure switch wire',
    why: 'a safety-circuit signal, too little current to read. Check it with the multimeter for voltage.',
  },
  'lv-c': {
    name: '24 V common (C) wire',
    why: 'control return current is too small to read here. Clamp the contactor coil lead or a line/load wire.',
  },
  'f-fs': {
    name: 'Flame sensor wire',
    why: 'flame current is only microamps. Use the multimeter on the µA DC range in series, not the clamp.',
  },
  'f-ps': {
    name: 'Pressure switch wire',
    why: 'a 24 V signal with almost no current. Clamp L1 or a motor lead, or check the switch with the multimeter.',
  },
};

/**
 * Why a hover-only object (one with a name but no action) is no use to the clamp meter, judged from
 * its name. Wire-like things get a reason; anything else is simply not a wire.
 */
export function clampReason(label: string): string {
  if (/24 ?V|thermostat|control/i.test(label)) return 'control current is too small to read. Clamp a line (L1/L2) or load wire in the control box.';
  if (/ground/i.test(label)) return 'carries no current unless there is a fault. Clamp L1, L2 or a load lead.';
  if (/harness|bundle/i.test(label)) return 'the bundled leads cancel each other out. Clamp one conductor at a time.';
  if (/wire|cable|whip|conduit|lead/i.test(label)) return 'no single conductor to clamp here. Clamp L1, L2 or a load lead in the control box.';
  return 'not a wire. The clamp reads current in one conductor: clamp L1, L2 or a load lead.';
}
