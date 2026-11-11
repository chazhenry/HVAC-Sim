/**
 * Refrigerant-circuit service work: recovery, nitrogen pressure test,
 * evacuation and charging by weight. This is the hands-on side of EPA 608.
 */

export const FACTORY_CHARGE_LB = 6.5;
export const RECOVERY_CYLINDER_LB = 30;
export const RECOVERY_CYLINDER_START_LB = 9;
export const CYLINDER_FILL_LIMIT = 0.8;
export const NAMEPLATE_TEST_PSIG = 250;
export const ATMOSPHERE_MICRONS = 760000;
/** Below this fraction of a charge there is no liquid left to hold saturation pressure. */
const TRACE_CHARGE = 0.06;
const HOLD_TEST_SECONDS = 12;

/** What the manifold's yellow centre hose is connected to. */
export type CenterHose = 'none' | 'recovery' | 'nitrogen' | 'vacuum' | 'cylinder';
export type TestGas = 'nitrogen' | 'air' | 'oxygen';

export interface ServiceState {
  hose: CenterHose;
  /** Machine running / valve open on whatever the centre hose feeds. */
  running: boolean;
  /**
   * System pressure in psig while there is too little refrigerant for the
   * pressure-temperature relationship to apply (empty, under nitrogen, under
   * vacuum). null = normal: pressure follows saturation.
   */
  staticPsig: number | null;
  opened: boolean;
  openedAtPsig: number | null;
  /** Air charged over: raises head pressure until the charge is recovered again. */
  nonCondensables: boolean;
  /** 0 = dry, 1 = system was open to humid air. */
  moisture: number;
  /** Micron gauge reading. */
  microns: number;
  deepestMicrons: number;
  /** Reading at the moment the pump was valved off; null while pumping. */
  holdBase: number | null;
  heldFor: number;
  /** Result of the last completed standing vacuum test. */
  heldMicrons: number | null;
  recoveredLb: number;
  addedLb: number;
  regulatorPsig: number;
  testGas: TestGas;
  pressureTestPsig: number;
  pressureTestGas: TestGas | null;
}

export const initialService = (): ServiceState => ({
  hose: 'none',
  running: false,
  staticPsig: null,
  opened: false,
  openedAtPsig: null,
  nonCondensables: false,
  moisture: 0,
  microns: ATMOSPHERE_MICRONS,
  deepestMicrons: ATMOSPHERE_MICRONS,
  holdBase: null,
  heldFor: 0,
  heldMicrons: null,
  recoveredLb: 0,
  addedLb: 0,
  regulatorPsig: 150,
  testGas: 'nitrogen',
  pressureTestPsig: 0,
  pressureTestGas: null,
});

export type ServiceEvent = 'svc_zero' | 'svc_500' | 'svc_hold_pass' | 'svc_hold_fail' | 'svc_overfill';

const approach = (value: number, target: number, tau: number, dt: number): number =>
  target + (value - target) * Math.exp(-dt / tau);

export const cylinderFill = (s: ServiceState): number =>
  (RECOVERY_CYLINDER_START_LB + s.recoveredLb) / RECOVERY_CYLINDER_LB;

/** Vacuum shown on a compound gauge, in inches of mercury (0 at atmospheric). */
export const inchesHg = (psig: number): number => Math.max(0, -psig * 2.036);

export interface ServiceStep {
  service: ServiceState;
  /** Refrigerant in the system as a fraction of the factory charge. */
  charge: number;
  events: ServiceEvent[];
}

export function stepService(
  prev: ServiceState,
  chargeIn: number,
  equalisedPsig: number,
  compressorRunning: boolean,
  dt: number,
): ServiceStep {
  const s: ServiceState = { ...prev };
  const events: ServiceEvent[] = [];
  let charge = chargeIn;
  const active = s.running ? s.hose : 'none';

  if (active === 'recovery') {
    if (charge > 0) {
      const moved = Math.min(charge, 0.045 * dt);
      charge -= moved;
      s.recoveredLb += moved * FACTORY_CHARGE_LB;
      if (cylinderFill(prev) <= CYLINDER_FILL_LIMIT && cylinderFill(s) > CYLINDER_FILL_LIMIT) events.push('svc_overfill');
    } else {
      // Charge is out: the machine keeps pulling the vapor space into a vacuum.
      s.staticPsig = Math.max(-13.5, (s.staticPsig ?? 0) - 0.6 * dt);
    }
    if (charge === 0) s.nonCondensables = false;
  }

  if (active === 'cylinder') {
    // Refrigerant charged on top of air or nitrogen traps it in the system.
    if (charge === 0) s.nonCondensables = s.microns > 5000;
    const moved = Math.min(1.4 - charge, (compressorRunning ? 0.03 : 0.07) * dt);
    charge += moved;
    s.addedLb += moved * FACTORY_CHARGE_LB;
    s.microns = ATMOSPHERE_MICRONS;
    s.holdBase = null;
  }

  if (active === 'nitrogen' && charge === 0) {
    const now = s.staticPsig ?? 0;
    s.staticPsig = Math.max(now, Math.min(s.regulatorPsig, now + 45 * dt));
    s.microns = ATMOSPHERE_MICRONS;
    s.holdBase = null;
    if (s.testGas !== 'nitrogen') s.moisture = 1;
    if (s.staticPsig > s.pressureTestPsig) {
      s.pressureTestPsig = s.staticPsig;
      s.pressureTestGas = s.testGas;
    }
  }

  if (active === 'vacuum' && charge === 0) {
    s.staticPsig = approach(s.staticPsig ?? 0, -14.6, 2.5, dt);
    // Moisture boiling off holds the reading up until it is gone.
    const target = 150 + s.moisture * 2500;
    s.microns = Math.exp(approach(Math.log(s.microns), Math.log(target), 4, dt));
    if (s.microns < 5000) s.moisture = Math.max(0, s.moisture - 0.03 * dt);
    if (prev.deepestMicrons > 500 && s.microns <= 500) events.push('svc_500');
    s.deepestMicrons = Math.min(s.deepestMicrons, s.microns);
    s.holdBase = null;
    s.heldFor = 0;
    s.heldMicrons = null;
  } else if (charge === 0 && s.microns < 100000) {
    // Pump valved off: a dry, tight system holds; a wet one creeps up and levels off.
    if (s.holdBase === null) s.holdBase = s.microns;
    s.microns = approach(s.microns, s.holdBase + 60 + s.moisture * 2000, 5, dt);
    s.heldFor += dt;
    if (prev.heldFor < HOLD_TEST_SECONDS && s.heldFor >= HOLD_TEST_SECONDS) {
      s.heldMicrons = s.microns;
      events.push(s.microns <= 500 ? 'svc_hold_pass' : 'svc_hold_fail');
    } else if (s.heldMicrons !== null) s.heldMicrons = s.microns;
  }

  // Which regime sets the system pressure?
  if (charge >= TRACE_CHARGE) s.staticPsig = null;
  else if (charge > 0) s.staticPsig = (equalisedPsig * charge) / TRACE_CHARGE;
  else if (s.staticPsig === null) s.staticPsig = 0;

  if (active === 'recovery' && (prev.staticPsig === null || prev.staticPsig > 0) && s.staticPsig !== null && s.staticPsig <= 0) {
    events.push('svc_zero');
  }
  return { service: s, charge, events };
}
