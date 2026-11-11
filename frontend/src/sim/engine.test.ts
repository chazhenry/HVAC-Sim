import { describe, expect, it } from 'vitest';
import type { Environment, UnitParams } from '../api/types';
import {
  createSim,
  liquidPsig,
  type SimEvent,
  type SimState,
  stepSim,
  subcoolF,
  suctionPsig,
  superheatF,
  resolve,
} from './engine';
import { probeVolts, readClamp, readMeter } from './instruments';

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
  for (let i = 0; i < seconds * 10; i++) {
    const r = stepSim(s, 0.1);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function start(unit: UnitParams, seconds = 90): { state: SimState; events: SimEvent[] } {
  const sim = createSim(unit, ENV);
  sim.controls.calling = true;
  return run(resolve(sim), seconds);
}

describe('healthy unit', () => {
  const { state: s, events } = start(healthy());

  it('starts both motors', () => {
    expect(events).toContain('contactor_in');
    expect(s.compressor).toBe('running');
    expect(s.fan).toBe('running');
  });

  it('settles at normal R-410A pressures, superheat and subcooling', () => {
    expect(suctionPsig(s)).toBeGreaterThan(110);
    expect(suctionPsig(s)).toBeLessThan(126);
    expect(liquidPsig(s)).toBeGreaterThan(360);
    expect(liquidPsig(s)).toBeLessThan(400);
    expect(superheatF(s)).toBeCloseTo(10, 0);
    expect(subcoolF(s)).toBeCloseTo(10, 0);
  });

  it('reads correct voltages', () => {
    expect(probeVolts(s, 'CONT_L1', 'CONT_L2')).toBeCloseTo(240, 0);
    // A little is lost across the disconnect and contactor contacts under load.
    expect(probeVolts(s, 'CONT_T1', 'CONT_T2')).toBeGreaterThan(238);
    expect(probeVolts(s, 'CONT_L1', 'GND_LUG')).toBeCloseTo(120, 0);
    expect(probeVolts(s, 'COIL_A', 'COIL_B')).toBeCloseTo(24, 0);
    expect(probeVolts(s, 'CONT_L1', 'CONT_T1')).toBeLessThan(1);
    // Run capacitor sees more than line voltage while the motor runs.
    expect(probeVolts(s, 'CAP_HERM', 'CAP_C')).toBeGreaterThan(280);
    expect(probeVolts(s, 'CAP_HERM', 'CAP_C')).toBeLessThan(400);
  });

  it('draws sensible current, below nameplate', () => {
    const common = readClamp(s, 'W_COMP_C');
    expect(common).toBeGreaterThan(9);
    expect(common).toBeLessThan(16);
    const fan = readClamp(s, 'W_FAN_BLK');
    expect(fan).toBeGreaterThan(0.8);
    expect(fan).toBeLessThan(1.6);
  });

  it('lets the capacitor be verified under load (amps x 2652 / volts)', () => {
    const uf = (readClamp(s, 'W_COMP_S') * 2652) / probeVolts(s, 'CAP_HERM', 'CAP_C');
    expect(uf).toBeGreaterThan(43);
    expect(uf).toBeLessThan(47);
  });

  it('refuses to ohm a live circuit, then reads windings with power off', () => {
    expect(readMeter(s, 'ohm', 'COMP_C', 'COMP_R').kind).toBe('live');
    const off = createSim(healthy(), ENV);
    off.controls.disconnectIn = false;
    const dead = resolve(off);
    expect(readMeter(dead, 'ohm', 'COMP_C', 'COMP_R')).toMatchObject({ kind: 'value', value: 0.9 });
    expect(readMeter(dead, 'ohm', 'COMP_S', 'COMP_R')).toMatchObject({ kind: 'value', value: 3.3 });
    expect(readMeter(dead, 'ohm', 'COIL_A', 'COIL_B')).toMatchObject({ kind: 'value', value: 12 });
    expect(readMeter(dead, 'uf', 'CAP_C', 'CAP_HERM')).toMatchObject({ kind: 'value', value: 45.2 });
    expect(readMeter(dead, 'ohm', 'CONT_L1', 'CONT_T1').kind).toBe('ol');
  });
});

describe('faults', () => {
  it('weak HERM capacitor: compressor stalls and trips its overload, fan runs', () => {
    const unit = healthy();
    unit.capacitor.hermUf = 8.6;
    const first = start(unit, 3);
    expect(first.state.compressor).toBe('locked');
    expect(first.state.fan).toBe('running');
    expect(readClamp(first.state, 'W_COMP_C')).toBeGreaterThan(50);
    const later = run(first.state, 4);
    expect(later.events).toContain('overload_trip');
    expect(readClamp(later.state, 'W_COMP_C')).toBe(0);
    // Open overload: C-R and C-S open, R-S still reads the windings.
    const off = { ...later.state, controls: { ...later.state.controls, disconnectIn: false } };
    const dead = run(resolve(off), 0.5).state;
    expect(readMeter(dead, 'ohm', 'COMP_C', 'COMP_R').kind).toBe('ol');
    expect(readMeter(dead, 'ohm', 'COMP_S', 'COMP_R').kind).toBe('value');
  });

  it('failed FAN capacitor: head pressure runs away and the HPS cycles the unit', () => {
    const unit = healthy();
    unit.capacitor.fanUf = 0.6;
    const { state, events } = start(unit, 60);
    expect(state.fanSpeed).toBeLessThan(0.05);
    expect(events).toContain('hps_trip');
    expect(events).toContain('hps_reset');
  });

  it('open contactor coil: 24 V present but nothing pulls in', () => {
    const unit = healthy();
    unit.contactor.coilOhms = null;
    const { state } = start(unit, 10);
    expect(state.contactorIn).toBe(false);
    expect(probeVolts(state, 'COIL_A', 'COIL_B')).toBeCloseTo(24, 0);
    expect(probeVolts(state, 'CONT_L1', 'CONT_L2')).toBeCloseTo(240, 0);
  });

  it('burnt contact: line voltage is dropped across the closed pole', () => {
    const unit = healthy();
    unit.contactor.pole1Ohms = null;
    const { state } = start(unit, 10);
    expect(state.contactorIn).toBe(true);
    expect(state.compressor).toBe('off');
    expect(probeVolts(state, 'CONT_T1', 'CONT_T2')).toBeLessThan(5);
    expect(probeVolts(state, 'CONT_L1', 'CONT_T1')).toBeGreaterThan(230);
    expect(probeVolts(state, 'CONT_L2', 'CONT_T2')).toBeLessThan(1);
  });

  it('blown L2 fuse: dead leg back-feeds through the windings', () => {
    const unit = healthy();
    unit.fuseL2Ok = false;
    const { state } = start(unit, 10);
    expect(state.compressor).toBe('off');
    expect(probeVolts(state, 'DISC_L1_LINE', 'DISC_L2_LINE')).toBeCloseTo(240, 0);
    expect(probeVolts(state, 'DISC_L1_LOAD', 'DISC_L2_LOAD')).toBeLessThan(5);
    // Dead leg shows 120 V to ground - back-feed, not a good fuse.
    expect(probeVolts(state, 'DISC_L2_LOAD', 'DISC_GND')).toBeGreaterThan(110);
    // Cross-check finds it: good line lug to the opposite load lug.
    expect(probeVolts(state, 'DISC_L1_LINE', 'DISC_L2_LOAD')).toBeLessThan(5);
    expect(probeVolts(state, 'DISC_L2_LINE', 'DISC_L1_LOAD')).toBeCloseTo(240, 0);
  });

  it('open fan winding: fan stalls with almost no current', () => {
    const unit = healthy();
    unit.fanMotor.runOhms = null;
    const { state } = start(unit, 4);
    expect(state.fan).toBe('locked');
    expect(readClamp(state, 'W_FAN_BLK')).toBeLessThan(0.7);
  });

  it('low charge: low suction, high superheat, low subcooling', () => {
    const unit = healthy();
    unit.chargeFraction = 0.72;
    const { state } = start(unit);
    expect(state.compressor).toBe('running');
    expect(suctionPsig(state)).toBeLessThan(95);
    expect(superheatF(state)).toBeGreaterThan(30);
    expect(subcoolF(state)).toBeLessThan(3);
  });

  it('dirty coil: high head and amps, normal subcooling, no trip', () => {
    const unit = healthy();
    unit.coilFouling = 0.7;
    const { state, events } = start(unit);
    expect(events).not.toContain('hps_trip');
    expect(liquidPsig(state)).toBeGreaterThan(460);
    expect(subcoolF(state)).toBeCloseTo(10, 0);
    expect(readClamp(state, 'W_COMP_C')).toBeGreaterThan(readClamp(start(healthy()).state, 'W_COMP_C') * 1.15);
  });
});
