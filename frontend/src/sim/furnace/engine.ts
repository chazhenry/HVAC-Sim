import type { Environment, FurnaceParams } from '../../api/types';
import { cabs, csub } from '../circuit';
import type { MotorState } from '../electrical';
import { type FSolution, type FSwitchState, type Relays, solveFurnace } from './electrical';

/** Where the integrated furnace control is in its sequence of operation. */
export type BoardPhase =
  | 'idle'
  | 'prepurge'
  | 'warmup'
  | 'trial'
  | 'run'
  | 'interpurge'
  | 'postpurge'
  | 'lockout'
  | 'limit';

/** LED flash code. 0 = steady on (normal). */
export type FaultCode = 0 | 1 | 2 | 3 | 4;

export const FAULT_CODES: Record<FaultCode, string> = {
  0: 'Steady on - normal',
  1: '1 flash - ignition lockout',
  2: '2 flashes - pressure switch stuck open',
  3: '3 flashes - pressure switch stuck closed',
  4: '4 flashes - high limit open',
};

export interface Board {
  phase: BoardPhase;
  /** Seconds in the current phase. */
  timer: number;
  /** Seconds the pressure switch has been proven during pre-purge. */
  purge: number;
  retries: number;
  /** Seconds of proven flame this cycle. */
  runFor: number;
  /** Seconds the blower will keep running (off-delay). */
  blowerHold: number;
  code: FaultCode;
  relays: Relays;
}

export interface FurnaceControls {
  /** Service switch on the side of the furnace. */
  powerOn: boolean;
  /** Blower door fitted, or the door switch taped down. */
  doorClosed: boolean;
  /** Thermostat calling for heat (W). */
  calling: boolean;
}

export interface FurnaceState {
  t: number;
  unit: FurnaceParams;
  env: Environment;
  controls: FurnaceControls;
  board: Board;
  psClosed: boolean;
  limitOpen: boolean;
  /** 0..1 of full speed. */
  inducerSpeed: number;
  blower: MotorState;
  blowerSpeed: number;
  /** 0 = cold, 1 = glowing orange. */
  igniterTemp: number;
  /** Gas valve coil is pulled in (whether or not gas is actually reaching it). */
  valveOpen: boolean;
  gasFlowing: boolean;
  flame: boolean;
  /** Heat-exchanger / supply-air temperature (F). */
  hxF: number;
  capCharged: boolean;
  solution: FSolution;
}

export type FEvent =
  | 'inducer_start'
  | 'inducer_stop'
  | 'ps_close'
  | 'igniter_glow'
  | 'gas_click'
  | 'burners_light'
  | 'burners_out'
  | 'blower_start'
  | 'blower_stall'
  | 'blower_stop'
  | 'limit_trip'
  | 'limit_reset'
  | 'lockout'
  | 'code_ps_open'
  | 'code_ps_closed';

// Timings are compressed versus a real board so a cycle is watchable.
const PREPURGE_S = 3;
const PS_TIMEOUT_S = 8;
const WARMUP_S = 6;
const TRIAL_S = 4;
const IGNITER_OVERLAP_S = 3;
const INTERPURGE_S = 5;
const POSTPURGE_S = 4;
const BLOWER_ON_DELAY_S = 6;
const BLOWER_OFF_DELAY_S = 10;
const MAX_TRIES = 3;

const FLAME_PROVE_UA = 0.8;
const CLEAN_FLAME_UA = 3.6;
const PS_CLOSE_WC = 0.65;
const PS_OPEN_WC = 0.5;
const FULL_DRAFT_WC = 1.15;
const MANIFOLD_WC = 3.5;
const LIMIT_OPEN_F = 160;
const LIMIT_CLOSE_F = 120;
/** Heat input and removal, tuned for a 52 F rise at full airflow. */
const HEAT_RATE_F_PER_S = 6;
const NOMINAL_RISE_F = 52;
const CAP_START_RATIO = 0.6;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const approach = (value: number, target: number, tau: number, dt: number): number =>
  target + (value - target) * Math.exp(-dt / tau);

export const fSwitchState = (s: FurnaceState): FSwitchState => ({
  powerOn: s.controls.powerOn,
  doorClosed: s.controls.doorClosed,
  calling: s.controls.calling,
  limitOpen: s.limitOpen,
  psClosed: s.psClosed,
  relays: s.board.relays,
  inducerTurning: s.inducerSpeed > 0.3,
  igniterTemp: s.igniterTemp,
  blower: s.blower,
});

const NO_RELAYS: Relays = { inducer: false, igniter: false, gas: false, blower: false };
const IDLE_BOARD: Board = {
  phase: 'idle',
  timer: 0,
  purge: 0,
  retries: 0,
  runFor: 0,
  blowerHold: 0,
  code: 0,
  relays: NO_RELAYS,
};

export function createFurnace(unit: FurnaceParams, env: Environment): FurnaceState {
  const state = {
    t: 0,
    unit: structuredClone(unit),
    env: { ...env },
    controls: { powerOn: true, doorClosed: true, calling: false },
    board: structuredClone(IDLE_BOARD),
    psClosed: false,
    limitOpen: false,
    inducerSpeed: 0,
    blower: 'off' as MotorState,
    blowerSpeed: 0,
    igniterTemp: 0,
    valveOpen: false,
    gasFlowing: false,
    flame: false,
    hxF: env.indoorF,
    capCharged: false,
    solution: undefined as unknown as FSolution,
  };
  state.solution = solveFurnace(state.unit, fSwitchState(state));
  return state;
}

/** Draft at the pressure tap, in inches of water column (negative = suction). */
export const draftWc = (s: FurnaceState): number =>
  -s.inducerSpeed * FULL_DRAFT_WC * (1 - s.unit.flueBlockage);
export const inletWc = (s: FurnaceState): number => (s.unit.gasCockOpen ? s.unit.gasInletWc : 0);
export const manifoldWc = (s: FurnaceState): number => (s.gasFlowing ? MANIFOLD_WC : 0);
export const tempRiseF = (s: FurnaceState): number => s.hxF - s.env.indoorF;
/** DC flame-rectification current the board sees. */
export const flameMicroamps = (s: FurnaceState): number =>
  s.flame ? CLEAN_FLAME_UA * (1 - s.unit.flameSensorDirt) * (1 + 0.03 * Math.sin(s.t * 9)) : 0;
/** True while the board has line power and its LED is lit. */
export const boardPowered = (s: FurnaceState): boolean => cabs(s.solution.v.L1_BD) > 100;

function relaysFor(b: Board): Relays {
  const p = b.phase;
  return {
    inducer: p !== 'idle' && p !== 'lockout',
    igniter: p === 'warmup' || (p === 'trial' && b.timer < IGNITER_OVERLAP_S),
    gas: p === 'trial' || p === 'run',
    blower: b.blowerHold > 0,
  };
}

interface Inputs {
  powered: boolean;
  secondaryOk: boolean;
  w: boolean;
  limitClosed: boolean;
  ps: boolean;
  flameProven: boolean;
}

/** The control board's sequence of operation. */
function stepBoard(prev: Board, input: Inputs, dt: number, events: FEvent[]): Board {
  if (!input.powered) return structuredClone(IDLE_BOARD); // a power cycle clears everything, including lockout

  const b: Board = { ...prev, timer: prev.timer + dt };
  const go = (phase: BoardPhase): void => {
    b.phase = phase;
    b.timer = 0;
    b.purge = 0;
  };
  const failedTry = (): void => {
    b.retries += 1;
    b.runFor = 0;
    if (b.retries >= MAX_TRIES) {
      b.code = 1;
      events.push('lockout');
      go('lockout');
    } else go('interpurge');
  };

  if (input.secondaryOk && !input.limitClosed && b.phase !== 'limit') {
    b.code = 4;
    b.runFor = 0;
    go('limit');
  }

  switch (b.phase) {
    case 'idle':
      if (!input.w) b.code = 0;
      else if (input.ps) {
        if (b.code !== 3) events.push('code_ps_closed');
        b.code = 3;
      } else {
        b.code = 0;
        go('prepurge');
      }
      break;
    case 'prepurge':
      if (!input.w) go('postpurge');
      else if (input.ps) {
        b.purge += dt;
        if (b.purge >= PREPURGE_S) {
          b.code = 0;
          go('warmup');
        }
      } else {
        b.purge = 0;
        if (b.timer > PS_TIMEOUT_S && b.code !== 2) {
          b.code = 2;
          events.push('code_ps_open');
        }
      }
      break;
    case 'warmup':
      if (!input.w) go('postpurge');
      else if (!input.ps) go('prepurge');
      else if (b.timer >= WARMUP_S) go('trial');
      break;
    case 'trial':
      if (!input.w) go('postpurge');
      else if (input.flameProven && b.timer >= 1) {
        b.runFor = 0;
        go('run');
      } else if (b.timer >= TRIAL_S) failedTry();
      break;
    case 'run':
      b.runFor += dt;
      if (b.runFor > 15) b.retries = 0;
      if (!input.w) go('postpurge');
      else if (!input.ps) {
        b.runFor = 0;
        go('prepurge');
      } else if (!input.flameProven) failedTry();
      break;
    case 'interpurge':
      if (!input.w) go('postpurge');
      else if (b.timer >= INTERPURGE_S) go('warmup');
      break;
    case 'postpurge':
      b.runFor = 0;
      if (b.timer >= POSTPURGE_S) go('idle');
      break;
    case 'lockout':
      // Cycling the thermostat resets a soft lockout.
      if (!input.w) {
        b.retries = 0;
        b.code = 0;
        go('idle');
      }
      break;
    case 'limit':
      if (input.limitClosed) {
        b.code = 0;
        go('idle');
      }
      break;
  }

  const blowerWanted = b.phase === 'limit' || (b.phase === 'run' && b.runFor >= BLOWER_ON_DELAY_S);
  b.blowerHold = blowerWanted ? BLOWER_OFF_DELAY_S : Math.max(0, b.blowerHold - dt);
  b.relays = relaysFor(b);
  return b;
}

export interface FStepResult {
  state: FurnaceState;
  events: FEvent[];
}

/** Advance the furnace by dt seconds. Pure: returns a new state. */
export function stepFurnace(prev: FurnaceState, dt: number): FStepResult {
  const events: FEvent[] = [];
  const { unit, env } = prev;
  const { v, i } = prev.solution;
  const volts = (a: keyof typeof v, b: keyof typeof v): number => cabs(csub(v[a], v[b]));

  // --- control board -------------------------------------------------------
  const board = stepBoard(
    prev.board,
    {
      powered: cabs(v.L1_BD) > 100,
      secondaryOk: cabs(v.SEC) > 18,
      w: volts('W', 'C') > 18,
      limitClosed: volts('LIM_IN', 'C') > 18,
      ps: volts('PS_IN', 'C') > 18,
      flameProven: flameMicroamps(prev) >= FLAME_PROVE_UA,
    },
    dt,
    events,
  );

  // --- inducer and pressure switch ----------------------------------------
  const inducerOn = volts('IND', 'N') > 100 && unit.inducerOhms !== null;
  const inducerSpeed = approach(prev.inducerSpeed, inducerOn ? 1 : 0, inducerOn ? 0.8 : 1.5, dt);
  if (inducerOn && prev.inducerSpeed < 0.05 && inducerSpeed >= 0.05) events.push('inducer_start');
  if (!inducerOn && prev.inducerSpeed >= 0.2 && inducerSpeed < 0.2) events.push('inducer_stop');
  const draft = inducerSpeed * FULL_DRAFT_WC * (1 - unit.flueBlockage);
  let psClosed = prev.psClosed;
  if (!psClosed && draft >= PS_CLOSE_WC && unit.pressureSwitchOk) {
    psClosed = true;
    events.push('ps_close');
  } else if (psClosed && (draft < PS_OPEN_WC || !unit.pressureSwitchOk)) psClosed = false;

  // --- ignition and flame ---------------------------------------------------
  const igniterHeating = cabs(i.IGNITER) > 1.5;
  const igniterTemp = approach(prev.igniterTemp, igniterHeating ? 1 : 0, igniterHeating ? 1.6 : 3, dt);
  if (prev.igniterTemp < 0.6 && igniterTemp >= 0.6) events.push('igniter_glow');

  const valveOpen = cabs(i.GAS_COIL) > 0.15;
  if (valveOpen && !prev.valveOpen) events.push('gas_click');
  const gasFlowing = valveOpen && unit.gasCockOpen;
  const flame = gasFlowing && (prev.flame || igniterTemp > 0.75);
  if (flame && !prev.flame) events.push('burners_light');
  if (!flame && prev.flame) events.push('burners_out');

  // --- blower ----------------------------------------------------------------
  const blowerVolts = volts('BLW', 'N');
  const blowerCanStart =
    unit.blowerRunOhms !== null &&
    unit.blowerAuxOhms !== null &&
    unit.blowerCapUf >= unit.ratedBlowerCapUf * CAP_START_RATIO;
  let blower = prev.blower;
  if (blower === 'off') {
    if (blowerVolts > 100) {
      blower = blowerCanStart ? 'running' : 'locked';
      events.push(blowerCanStart ? 'blower_start' : 'blower_stall');
    }
  } else if (blowerVolts < 80) {
    if (blower === 'running') events.push('blower_stop');
    blower = 'off';
  }
  const blowerSpeed = approach(prev.blowerSpeed, blower === 'running' ? 1 : 0, blower === 'running' ? 1.5 : 3, dt);

  // --- heat exchanger --------------------------------------------------------
  const airflow = Math.max(0.08, blowerSpeed * (1 - 0.6 * unit.filterDirt));
  const removal = (HEAT_RATE_F_PER_S / NOMINAL_RISE_F) * airflow * (prev.hxF - env.indoorF);
  const hxF = clamp(prev.hxF + ((flame ? HEAT_RATE_F_PER_S : 0) - removal) * dt, env.indoorF, 600);

  let limitOpen = prev.limitOpen;
  if (!limitOpen && hxF >= LIMIT_OPEN_F) {
    limitOpen = true;
    events.push('limit_trip');
  } else if (limitOpen && hxF <= LIMIT_CLOSE_F) {
    limitOpen = false;
    events.push('limit_reset');
  }

  const next: FurnaceState = {
    ...prev,
    t: prev.t + dt,
    board,
    psClosed,
    limitOpen,
    inducerSpeed,
    blower,
    blowerSpeed,
    igniterTemp,
    valveOpen,
    gasFlowing,
    flame,
    hxF,
    capCharged: prev.capCharged || volts('BLW_CAP', 'N') > 50,
  };
  next.solution = solveFurnace(unit, fSwitchState(next));
  return { state: next, events };
}

/** Re-solve after the learner changes a switch or a part between ticks. */
export function resolveFurnace(s: FurnaceState): FurnaceState {
  const solution = solveFurnace(s.unit, fSwitchState(s));
  if (cabs(solution.v.L1_BD) > 100) return { ...s, solution };
  // Dropping board power resets lockout and removes relay commands immediately,
  // even when a switch is cycled between animation ticks. Motors still coast on ticks.
  const off = { ...s, board: structuredClone(IDLE_BOARD), valveOpen: false, gasFlowing: false, flame: false };
  return { ...off, solution: solveFurnace(off.unit, fSwitchState(off)) };
}
