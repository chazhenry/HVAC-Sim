import { describe, expect, it } from 'vitest';
import type { Environment, FurnaceParams } from '../../api/types';
import {
  createFurnace,
  draftWc,
  type FEvent,
  type FurnaceState,
  inletWc,
  manifoldWc,
  resolveFurnace,
  stepFurnace,
  tempRiseF,
} from './engine';
import { fProbeVolts, fReadClamp, fReadMeter } from './instruments';

const ENV: Environment = { outdoorF: 28, indoorF: 64, setpointF: 70 };

const healthy = (): FurnaceParams => ({
  fuseOk: true,
  igniterOhms: 55,
  flameSensorDirt: 0.05,
  pressureSwitchOk: true,
  inducerOhms: 28,
  flueBlockage: 0,
  gasValveCoilOhms: 48,
  gasCockOpen: true,
  gasInletWc: 7,
  blowerRunOhms: 3.2,
  blowerAuxOhms: 9.5,
  ratedBlowerCapUf: 7.5,
  blowerCapUf: 7.4,
  filterDirt: 0.1,
  limitOk: true,
});

function run(state: FurnaceState, seconds: number): { state: FurnaceState; events: FEvent[] } {
  const events: FEvent[] = [];
  let s = state;
  for (let i = 0; i < seconds * 10; i++) {
    const r = stepFurnace(s, 0.1);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

function heat(unit: FurnaceParams, seconds = 90): { state: FurnaceState; events: FEvent[] } {
  const f = createFurnace(unit, ENV);
  f.controls.calling = true;
  return run(resolveFurnace(f), seconds);
}

describe('healthy furnace', () => {
  const { state: s, events } = heat(healthy());

  it('follows the sequence of operation in order', () => {
    const order = ['inducer_start', 'ps_close', 'igniter_glow', 'gas_click', 'burners_light', 'blower_start'] as const;
    const at = order.map((e) => events.indexOf(e));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(s.board.phase).toBe('run');
    expect(s.board.code).toBe(0);
  });

  it('settles at a nameplate temperature rise without tripping the limit', () => {
    expect(events).not.toContain('limit_trip');
    expect(tempRiseF(s)).toBeGreaterThan(45);
    expect(tempRiseF(s)).toBeLessThan(62);
  });

  it('gives textbook readings', () => {
    expect(fProbeVolts(s, 'F_BD_L1', 'F_BD_N')).toBeCloseTo(120, 0);
    expect(fProbeVolts(s, 'F_BD_R', 'F_BD_C')).toBeCloseTo(24, 0);
    expect(fProbeVolts(s, 'F_BD_W', 'F_BD_C')).toBeCloseTo(24, 0);
    expect(fProbeVolts(s, 'F_GV_MV', 'F_GV_C')).toBeGreaterThan(23);
    expect(fProbeVolts(s, 'F_PS_A', 'F_PS_B')).toBeLessThan(1);
    expect(manifoldWc(s)).toBeCloseTo(3.5, 1);
    expect(inletWc(s)).toBeCloseTo(7, 1);
    expect(draftWc(s)).toBeLessThan(-1);
    expect(fReadMeter(s, 'ua', 'F_FS_ROD', 'F_BD_FS')).toMatchObject({ kind: 'value', unit: 'µA' });
    const blower = fReadClamp(s, 'F_W_BLW');
    expect(blower).toBeGreaterThan(4);
    expect(blower).toBeLessThan(8);
  });

  it('shuts down cleanly when the call ends, with a blower off-delay', () => {
    const off = resolveFurnace({ ...s, controls: { ...s.controls, calling: false } });
    const soon = run(off, 3);
    expect(soon.state.flame).toBe(false);
    expect(soon.state.blower).toBe('running');
    const later = run(soon.state, 20);
    expect(later.state.blower).toBe('off');
    expect(later.state.inducerSpeed).toBeLessThan(0.05);
  });

  it('dies when the blower door comes off, until the door switch is held', () => {
    const open = run(resolveFurnace({ ...s, controls: { ...s.controls, doorClosed: false } }), 2).state;
    expect(open.flame).toBe(false);
    expect(fProbeVolts(open, 'F_DS_IN', 'F_DS_OUT')).toBeCloseTo(120, 0);
    expect(fProbeVolts(open, 'F_BD_R', 'F_BD_C')).toBeLessThan(1);
  });
});

describe('furnace faults', () => {
  it('dirty flame sensor: lights three times, then locks out', () => {
    const unit = healthy();
    unit.flameSensorDirt = 0.9;
    const { state, events } = heat(unit, 70);
    expect(events.filter((e) => e === 'burners_light')).toHaveLength(3);
    expect(state.board.phase).toBe('lockout');
    expect(state.board.code).toBe(1);
    expect(events).not.toContain('blower_start');
  });

  it('dirty flame sensor reads low microamps while lit', () => {
    const unit = healthy();
    unit.flameSensorDirt = 0.9;
    const f = createFurnace(unit, ENV);
    f.controls.calling = true;
    let s = resolveFurnace(f);
    let reading = 0;
    for (let i = 0; i < 300 && reading === 0; i++) {
      s = stepFurnace(s, 0.1).state;
      const r = fReadMeter(s, 'ua', 'F_BD_FS', 'F_FS_ROD');
      if (r.kind === 'value') reading = r.value;
    }
    expect(reading).toBeGreaterThan(0.2);
    expect(reading).toBeLessThan(0.6);
  });

  it('open igniter: 120 V at the plug, no glow, no flame, lockout', () => {
    const unit = healthy();
    unit.igniterOhms = null;
    const f = createFurnace(unit, ENV);
    f.controls.calling = true;
    const warm = run(resolveFurnace(f), 9).state;
    expect(warm.board.phase).toBe('warmup');
    expect(fProbeVolts(warm, 'F_IGN_H', 'F_IGN_N')).toBeCloseTo(120, 0);
    expect(fReadClamp(warm, 'F_W_IGN')).toBe(0);
    const { state, events } = run(warm, 60);
    expect(events).not.toContain('burners_light');
    expect(state.board.code).toBe(1);
    const dead = resolveFurnace({ ...state, controls: { ...state.controls, powerOn: false } });
    expect(fReadMeter(dead, 'ohm', 'F_IGN_H', 'F_IGN_N').kind).toBe('ol');
  });

  it('dead inducer: voltage at the motor, pressure switch never closes, 2 flashes', () => {
    const unit = healthy();
    unit.inducerOhms = null;
    const { state, events } = heat(unit, 20);
    expect(events).not.toContain('ps_close');
    expect(state.board.code).toBe(2);
    expect(fProbeVolts(state, 'F_IND_H', 'F_IND_N')).toBeCloseTo(120, 0);
    expect(draftWc(state)).toBeCloseTo(0, 1);
  });

  it('failed pressure switch: good draft but 24 V dropped across the switch', () => {
    const unit = healthy();
    unit.pressureSwitchOk = false;
    const { state } = heat(unit, 20);
    expect(state.board.code).toBe(2);
    expect(draftWc(state)).toBeLessThan(-1);
    expect(fProbeVolts(state, 'F_PS_A', 'F_PS_B')).toBeGreaterThan(22);
  });

  it('gas shut off: valve gets 24 V, no inlet pressure, no flame', () => {
    const unit = healthy();
    unit.gasCockOpen = false;
    const { state, events } = heat(unit, 70);
    expect(events).toContain('igniter_glow');
    expect(events).toContain('gas_click');
    expect(events).not.toContain('burners_light');
    expect(inletWc(state)).toBe(0);
    expect(state.board.code).toBe(1);
  });

  it('open gas valve coil: 24 V present, no current, no manifold pressure', () => {
    const unit = healthy();
    unit.gasValveCoilOhms = null;
    const f = createFurnace(unit, ENV);
    f.controls.calling = true;
    const trial = run(resolveFurnace(f), 13).state;
    expect(trial.board.phase).toBe('trial');
    expect(fProbeVolts(trial, 'F_GV_MV', 'F_GV_C')).toBeGreaterThan(23);
    expect(fReadClamp(trial, 'F_W_GV')).toBe(0);
    expect(manifoldWc(trial)).toBe(0);
    expect(inletWc(trial)).toBe(7);
  });

  it('plugged filter: blower runs but the limit trips and resets', () => {
    const unit = healthy();
    unit.filterDirt = 0.9;
    const { events } = heat(unit, 120);
    expect(events).toContain('blower_start');
    expect(events).toContain('limit_trip');
    expect(events).toContain('limit_reset');
  });

  it('failed blower capacitor: motor stalls at high amps, limit trips', () => {
    const unit = healthy();
    unit.blowerCapUf = 1.1;
    const { state, events } = heat(unit, 60);
    expect(events).toContain('blower_stall');
    expect(events).toContain('limit_trip');
    expect(state.blowerSpeed).toBeLessThan(0.05);
  });

  it('blown board fuse: 24 V at the transformer, nothing on R, no call seen', () => {
    const unit = healthy();
    unit.fuseOk = false;
    const { state, events } = heat(unit, 15);
    expect(events).toHaveLength(0);
    expect(state.board.phase).toBe('idle');
    expect(fProbeVolts(state, 'F_BD_SEC', 'F_BD_C')).toBeCloseTo(24, 0);
    expect(fProbeVolts(state, 'F_BD_R', 'F_BD_C')).toBeLessThan(1);
    expect(fProbeVolts(state, 'F_BD_SEC', 'F_BD_R')).toBeGreaterThan(22);
  });
});
