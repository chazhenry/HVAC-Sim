import { describe, expect, it } from 'vitest';
import type { Environment, UnitParams } from '../api/types';
import { createSim, liquidPsig, resolve, type SimEvent, type SimState, stepSim, suctionPsig } from './engine';
import { ATMOSPHERE_MICRONS, FACTORY_CHARGE_LB, type ServiceState } from './service';

const ENV: Environment = { outdoorF: 95, indoorF: 78, setpointF: 72 };

const healthy = (): UnitParams => ({
  fuseL1Ok: true,
  fuseL2Ok: true,
  contactor: { coilOhms: 12, pole1Ohms: 0.01, pole2Ohms: 0.01 },
  capacitor: { ratedHermUf: 45, ratedFanUf: 5, hermUf: 45.2, fanUf: 5 },
  compressor: { runOhms: 0.9, startOhms: 2.4, rla: 16, lra: 75 },
  fanMotor: { runOhms: 38, auxOhms: 62, seized: false, fla: 1.4 },
  chargeFraction: 1,
  coilFouling: 0,
});

function run(state: SimState, seconds: number): { state: SimState; events: SimEvent[] } {
  const events: SimEvent[] = [];
  let s = state;
  for (let i = 0; i < Math.round(seconds * 10); i++) {
    const r = stepSim(s, 0.1);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

const svc = (s: SimState, patch: Partial<ServiceState>): SimState => ({ ...s, service: { ...s.service, ...patch } });

/** Recover the whole charge, then open the system to the air as the repair does. */
function recoveredAndOpened(): SimState {
  const start = svc(createSim(healthy(), ENV), { hose: 'recovery', running: true });
  const { state } = run(start, 30);
  return svc(state, { running: false, opened: true, staticPsig: 0, moisture: 1, microns: ATMOSPHERE_MICRONS });
}

describe('recovery', () => {
  const { state, events } = run(svc(createSim(healthy(), ENV), { hose: 'recovery', running: true }), 30);

  it('moves the whole charge into the cylinder and reaches 0 psig', () => {
    expect(state.unit.chargeFraction).toBe(0);
    expect(state.service.recoveredLb).toBeCloseTo(FACTORY_CHARGE_LB, 1);
    expect(events).toContain('svc_zero');
    expect(suctionPsig(state)).toBeLessThanOrEqual(0);
    expect(liquidPsig(state)).toBe(suctionPsig(state));
  });

  it('pressure falls away only once the liquid is gone', () => {
    const early = run(svc(createSim(healthy(), ENV), { hose: 'recovery', running: true }), 10).state;
    expect(early.unit.chargeFraction).toBeGreaterThan(0.4);
    expect(suctionPsig(early)).toBeGreaterThan(200);
  });
});

describe('pressure test and evacuation', () => {
  it('nitrogen rises to the regulator setting and holds', () => {
    const pressurised = run(svc(recoveredAndOpened(), { hose: 'nitrogen', running: true, regulatorPsig: 150 }), 6).state;
    expect(suctionPsig(pressurised)).toBeCloseTo(150, 0);
    const held = run(svc(pressurised, { running: false }), 10).state;
    expect(suctionPsig(held)).toBeCloseTo(150, 0);
    expect(held.service.pressureTestGas).toBe('nitrogen');
  });

  it('a wet system stalls well above 500 microns, then dries out', () => {
    const pumping = svc(recoveredAndOpened(), { hose: 'vacuum', running: true });
    const early = run(pumping, 15).state;
    expect(early.service.microns).toBeGreaterThan(1000);
    const { state: late, events } = run(early, 55);
    expect(late.service.microns).toBeLessThan(300);
    expect(events).toContain('svc_500');
  });

  it('valving off too early fails the standing test; a dry system passes', () => {
    const pumping = svc(recoveredAndOpened(), { hose: 'vacuum', running: true });
    const hasty = run(svc(run(pumping, 22).state, { running: false }), 15);
    expect(hasty.events).toContain('svc_hold_fail');
    expect(hasty.state.service.heldMicrons).toBeGreaterThan(500);

    const patient = run(svc(run(pumping, 70).state, { running: false }), 15);
    expect(patient.events).toContain('svc_hold_pass');
    expect(patient.state.service.heldMicrons).toBeLessThan(500);
  });
});

describe('charging', () => {
  const evacuated = (): SimState =>
    svc(run(svc(recoveredAndOpened(), { hose: 'vacuum', running: true }), 70).state, { running: false });

  it('weighing in the factory charge after a good vacuum gives normal operation', () => {
    const charged = run(svc(evacuated(), { hose: 'cylinder', running: true }), 1 / 0.07).state;
    expect(charged.service.addedLb).toBeCloseTo(FACTORY_CHARGE_LB, 0);
    const closed = svc(charged, { running: false, hose: 'none' });
    const running = run(resolve({ ...closed, controls: { ...closed.controls, calling: true } }), 90).state;
    expect(running.compressor).toBe('running');
    expect(running.service.nonCondensables).toBe(false);
    expect(liquidPsig(running)).toBeGreaterThan(355);
    expect(liquidPsig(running)).toBeLessThan(405);
  });

  it('charging without evacuating traps air and drives head pressure up', () => {
    const charged = run(svc(recoveredAndOpened(), { hose: 'cylinder', running: true }), 1 / 0.07).state;
    expect(charged.service.nonCondensables).toBe(true);
    const closed = svc(charged, { running: false, hose: 'none' });
    const running = run(resolve({ ...closed, controls: { ...closed.controls, calling: true } }), 90).state;
    expect(liquidPsig(running)).toBeGreaterThan(450);
  });

  it('an empty system cannot run: the low-pressure switch keeps the contactor out', () => {
    const empty = recoveredAndOpened();
    const { state } = run(resolve({ ...empty, controls: { ...empty.controls, calling: true } }), 20);
    expect(state.compressor).toBe('off');
    expect(state.lpsOpen).toBe(true);
  });
});
