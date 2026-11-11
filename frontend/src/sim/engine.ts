import type { Environment, UnitParams } from '../api/types';
import { cabs, csub } from './circuit';
import { type AcSolution, type MotorState, type SwitchState, solveAc } from './electrical';
import { satPsig } from './refrigerant';
import { initialService, type ServiceEvent, type ServiceState, stepService } from './service';

export interface Controls {
  disconnectIn: boolean;
  /** Thermostat set to COOL and calling. */
  calling: boolean;
}

export interface Thermo {
  /** Condensing saturation temperature (F). */
  headSatF: number;
  /** Evaporating saturation temperature (F). */
  suctSatF: number;
  suctionLineF: number;
  liquidLineF: number;
}

export interface SimState {
  /** Simulated seconds since the session started. */
  t: number;
  unit: UnitParams;
  env: Environment;
  controls: Controls;
  contactorIn: boolean;
  hpsOpen: boolean;
  lpsOpen: boolean;
  overloadOpen: boolean;
  /** 0..1 thermal load on the compressor's internal overload. */
  overloadHeat: number;
  compressor: MotorState;
  fan: MotorState;
  /** Fan speed, 0..1 of full rpm. */
  fanSpeed: number;
  compressorLoadAmps: number;
  thermo: Thermo;
  /** The run capacitor has been energised and not yet discharged. */
  capCharged: boolean;
  /** Recovery / evacuation / charging equipment and what it has done. */
  service: ServiceState;
  solution: AcSolution;
}

export type SimEvent =
  | 'contactor_in'
  | 'contactor_out'
  | 'compressor_start'
  | 'compressor_stall'
  | 'compressor_stop'
  | 'overload_trip'
  | 'overload_reset'
  | 'fan_start'
  | 'fan_stall'
  | 'fan_stop'
  | 'hps_trip'
  | 'hps_reset'
  | 'lps_trip'
  | 'lps_reset'
  | ServiceEvent;

const PULL_IN_VOLTS = 18;
const DROP_OUT_VOLTS = 12;
const MOTOR_START_VOLTS = 190;
const MOTOR_STOP_VOLTS = 165;
const CAP_START_RATIO = 0.6;
const OVERLOAD_TRIP_SECONDS = 5;
const OVERLOAD_RESET_SECONDS = 22;
const HPS_OPEN_PSIG = 610;
const HPS_CLOSE_PSIG = 420;
const LPS_OPEN_PSIG = 50;
const LPS_CLOSE_PSIG = 95;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const approach = (value: number, target: number, tau: number, dt: number): number =>
  target + (value - target) * Math.exp(-dt / tau);

export const switchState = (s: SimState): SwitchState => ({
  disconnectIn: s.controls.disconnectIn,
  calling: s.controls.calling,
  contactorIn: s.contactorIn,
  hpsOpen: s.hpsOpen,
  lpsOpen: s.lpsOpen,
  overloadOpen: s.overloadOpen,
  compressor: s.compressor,
  fan: s.fan,
  compressorLoadAmps: s.compressorLoadAmps,
});

const equalisedF = (env: Environment): number => 0.6 * env.outdoorF + 0.4 * env.indoorF;

export function createSim(unit: UnitParams, env: Environment): SimState {
  const eq = equalisedF(env);
  const base: Omit<SimState, 'solution'> = {
    t: 0,
    unit: structuredClone(unit),
    env: { ...env },
    controls: { disconnectIn: true, calling: false },
    contactorIn: false,
    hpsOpen: false,
    lpsOpen: false,
    overloadOpen: false,
    overloadHeat: 0,
    compressor: 'off',
    fan: 'off',
    fanSpeed: 0,
    compressorLoadAmps: unit.compressor.rla * 0.78,
    thermo: { headSatF: eq, suctSatF: eq, suctionLineF: env.outdoorF, liquidLineF: env.outdoorF },
    capCharged: false,
    service: initialService(),
  };
  const withSolution = { ...base, solution: undefined as unknown as AcSolution };
  withSolution.solution = solveAc(base.unit, switchState(withSolution));
  return withSolution;
}

/** Superheat and subcooling as the refrigerant actually has them right now. */
export const superheatF = (s: SimState): number => s.thermo.suctionLineF - s.thermo.suctSatF;
export const subcoolF = (s: SimState): number => s.thermo.headSatF - s.thermo.liquidLineF;
/** Gauge pressures. With the charge out, the service state sets them instead of saturation. */
export const suctionPsig = (s: SimState): number => s.service.staticPsig ?? satPsig(s.thermo.suctSatF);
export const liquidPsig = (s: SimState): number => s.service.staticPsig ?? satPsig(s.thermo.headSatF);

function stepThermo(s: SimState, dt: number): Thermo {
  const { env, unit, thermo } = s;
  if (s.compressor !== 'running') {
    const eq = equalisedF(env);
    return {
      headSatF: approach(thermo.headSatF, eq, 25, dt),
      suctSatF: approach(thermo.suctSatF, eq, 25, dt),
      suctionLineF: approach(thermo.suctionLineF, env.outdoorF, 30, dt),
      liquidLineF: approach(thermo.liquidLineF, env.outdoorF, 30, dt),
    };
  }

  const charge = unit.chargeFraction;
  const under = Math.max(0, 1 - charge);
  const over = Math.max(0, charge - 1);

  // Condenser: how far above ambient it must run to reject the heat.
  const airflow = Math.max(0.05, s.fanSpeed * (1 - 0.75 * unit.coilFouling));
  // Air trapped in the condenser adds its own pressure on top of the refrigerant's.
  const air = s.service.nonCondensables ? 28 : 0;
  const split = (18 / airflow) * (0.6 + 0.4 * Math.min(charge, 1)) + over * 70 + air;
  const headTarget = Math.min(env.outdoorF + split, 190);

  const suctTarget =
    40 - 65 * under + 15 * over + 0.06 * (thermo.headSatF - (env.outdoorF + 18));
  const superheat = clamp(10 + 110 * under - 40 * over, 2, 60);
  const subcool = clamp(10 + 38 * (charge - 1), 0.5, 28);

  const headSatF = approach(thermo.headSatF, headTarget, 10, dt);
  const suctSatF = approach(thermo.suctSatF, suctTarget, 6, dt);
  return {
    headSatF,
    suctSatF,
    suctionLineF: approach(thermo.suctionLineF, suctSatF + superheat, 7, dt),
    liquidLineF: approach(thermo.liquidLineF, headSatF - subcool, 7, dt),
  };
}

export interface StepResult {
  state: SimState;
  events: SimEvent[];
}

/** Advance the simulation by dt seconds. Pure: returns a new state. */
export function stepSim(prev: SimState, dt: number): StepResult {
  const events: SimEvent[] = [];
  const { v } = prev.solution;

  // --- service equipment on the refrigerant circuit -------------------------
  const serviced = stepService(
    prev.service,
    prev.unit.chargeFraction,
    satPsig(equalisedF(prev.env)),
    prev.compressor === 'running',
    dt,
  );
  events.push(...serviced.events);
  const service = serviced.service;
  const unit =
    serviced.charge === prev.unit.chargeFraction
      ? prev.unit
      : { ...prev.unit, chargeFraction: serviced.charge };
  const volts = (a: keyof typeof v, b: keyof typeof v): number => cabs(csub(v[a], v[b]));

  // --- contactor -----------------------------------------------------------
  const coilVolts = unit.contactor.coilOhms === null ? 0 : volts('COIL_Y', 'LV_C');
  let contactorIn = prev.contactorIn;
  if (!contactorIn && coilVolts >= PULL_IN_VOLTS) {
    contactorIn = true;
    events.push('contactor_in');
  } else if (contactorIn && coilVolts < DROP_OUT_VOLTS) {
    contactorIn = false;
    events.push('contactor_out');
  }

  // --- compressor ----------------------------------------------------------
  const compVolts = volts('COMP_INT', 'T2');
  const { compressor: comp, capacitor: cap, fanMotor } = unit;
  const compCanStart =
    comp.runOhms !== null &&
    comp.startOhms !== null &&
    cap.hermUf >= cap.ratedHermUf * CAP_START_RATIO;
  let compressor = prev.compressor;
  if (compressor === 'off') {
    if (compVolts > MOTOR_START_VOLTS && comp.runOhms !== null) {
      compressor = compCanStart ? 'running' : 'locked';
      events.push(compCanStart ? 'compressor_start' : 'compressor_stall');
    }
  } else if (compVolts < MOTOR_STOP_VOLTS) {
    if (compressor === 'running') events.push('compressor_stop');
    compressor = 'off';
  }

  // Internal overload: heats on locked rotor, cools slowly, auto-resets.
  let overloadHeat = prev.overloadHeat;
  let overloadOpen = prev.overloadOpen;
  if (compressor === 'locked') overloadHeat += dt / OVERLOAD_TRIP_SECONDS;
  else overloadHeat -= dt / OVERLOAD_RESET_SECONDS;
  overloadHeat = clamp(overloadHeat, 0, 1);
  if (!overloadOpen && overloadHeat >= 1) {
    overloadOpen = true;
    events.push('overload_trip');
  } else if (overloadOpen && overloadHeat <= 0) {
    overloadOpen = false;
    events.push('overload_reset');
  }

  // --- condenser fan -------------------------------------------------------
  const fanVolts = volts('T1', 'T2');
  const fanCanStart =
    fanMotor.runOhms !== null &&
    fanMotor.auxOhms !== null &&
    !fanMotor.seized &&
    cap.fanUf >= cap.ratedFanUf * CAP_START_RATIO;
  let fan = prev.fan;
  if (fan === 'off') {
    if (fanVolts > MOTOR_START_VOLTS) {
      fan = fanCanStart ? 'running' : 'locked';
      events.push(fanCanStart ? 'fan_start' : 'fan_stall');
    }
  } else if (fanVolts < MOTOR_STOP_VOLTS) {
    if (fan === 'running') events.push('fan_stop');
    fan = 'off';
  }
  const fanSpeed = approach(prev.fanSpeed, fan === 'running' ? 1 : 0, fan === 'running' ? 1.2 : 2.5, dt);

  // --- refrigerant circuit ---------------------------------------------------
  const thermo = stepThermo({ ...prev, unit, service, compressor, fanSpeed }, dt);
  const head = service.staticPsig ?? satPsig(thermo.headSatF);
  const suct = service.staticPsig ?? satPsig(thermo.suctSatF);

  let hpsOpen = prev.hpsOpen;
  if (!hpsOpen && head >= HPS_OPEN_PSIG) {
    hpsOpen = true;
    events.push('hps_trip');
  } else if (hpsOpen && head <= HPS_CLOSE_PSIG) {
    hpsOpen = false;
    events.push('hps_reset');
  }
  let lpsOpen = prev.lpsOpen;
  if (!lpsOpen && suct <= LPS_OPEN_PSIG) {
    lpsOpen = true;
    // Only worth announcing if it actually stopped a running unit.
    if (prev.compressor === 'running') events.push('lps_trip');
  } else if (lpsOpen && suct >= LPS_CLOSE_PSIG) {
    lpsOpen = false;
    events.push('lps_reset');
  }

  // Compressor works harder against a higher head and a denser suction gas.
  const compressorLoadAmps =
    comp.rla * 0.78 * (0.3 + 0.7 * (head / 380)) * (0.85 + 0.15 * (suct / 118));

  const capCharged =
    prev.capCharged || volts('COMP_S', 'T2') > 50 || volts('FAN_BRN', 'T2') > 50;

  const next: SimState = {
    ...prev,
    t: prev.t + dt,
    unit,
    service,
    contactorIn,
    hpsOpen,
    lpsOpen,
    overloadOpen,
    overloadHeat,
    compressor,
    fan,
    fanSpeed,
    compressorLoadAmps,
    thermo,
    capCharged,
  };
  next.solution = solveAc(unit, switchState(next));
  return { state: next, events };
}

/** Re-solve after the learner changes something (a switch, a part) between ticks. */
export function resolve(s: SimState): SimState {
  return { ...s, solution: solveAc(s.unit, switchState(s)) };
}
