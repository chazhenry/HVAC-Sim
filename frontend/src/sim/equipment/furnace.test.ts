import { beforeEach, describe, expect, it } from 'vitest';
import type { FurnaceParams } from '../../api/types';
import { createFurnace, resolveFurnace, stepFurnace, tempRiseF } from '../furnace/engine';
import type { FTestPointId } from '../furnace/testPoints';
import type { MeterMode } from '../instruments';
import { useSim } from '../../store/useSim';
import { applyFurnaceAction } from './furnaceActions';
import { furnaceMeasurements } from './furnaceMeasurements';
import { procedureById, procedureProgress } from './procedures';
import type { FurnaceActionState, FurnaceTarget, ToolId } from './types';

const healthy: FurnaceParams = { fuseOk: true, igniterOhms: 55, flameSensorDirt: .05, pressureSwitchOk: true,
  inducerOhms: 28, flueBlockage: 0, gasValveCoilOhms: 48, gasCockOpen: true, gasInletWc: 7,
  blowerRunOhms: 3.2, blowerAuxOhms: 9.5, ratedBlowerCapUf: 7.5, blowerCapUf: 7.4, filterDirt: .1, limitOk: true };
const env = { outdoorF: 28, indoorF: 64, setpointF: 70 };
const state = (): FurnaceActionState => ({ furnace: createFurnace(healthy, env), fdoors: { burner: false, blower: false },
  doorSwitchTaped: false, manoAt: null, probes: { supply: false, return: false } });
const job = () => useSim.getState();
const click = (target: FurnaceTarget, tool: ToolId = 'hand'): void => { job().setTool(tool); job().clickFurnace(target); };
const meter = (mode: MeterMode, a: FTestPointId, b: FTestPointId): void => {
  job().clearLeads(); job().setMeterMode(mode); job().setTool('multimeter'); job().probe(a); job().probe(b);
};
const run = (seconds: number): void => { for (let n = 0; n < seconds * 10; n++) job().tick(.1); };

describe('isolated furnace commands', () => {
  it('keeps controller, relays and physical parameters independent', () => {
    const a = state(); const b = state();
    a.furnace.board.retries = 99; a.furnace.board.relays.gas = true; a.furnace.unit.igniterOhms = 0;
    expect(b.furnace.board.retries).toBe(0); expect(b.furnace.board.relays.gas).toBe(false);
    expect(b.furnace.unit.igniterOhms).toBe(55); expect(healthy.igniterOhms).toBe(55);
    a.furnace.controls.powerOn = false; b.furnace.controls.powerOn = false;
    const offA = stepFurnace(resolveFurnace(a.furnace), .1).state;
    const offB = stepFurnace(resolveFurnace(b.furnace), .1).state;
    offA.board.relays.gas = true;
    expect(offB.board.relays.gas).toBe(false);
  });
  it('enforces access and records both electrical and gas hazards without mutating input', () => {
    const original = state(); const before = structuredClone(original);
    const command = { type: 'furnace.use', target: 'gasValve', tool: 'part_gasvalve' } as const;
    expect(applyFurnaceAction({ ...original, fdoors: { burner: true, blower: false } }, command).repairs).toEqual([]);
    const unsafe = applyFurnaceAction(original, command);
    expect(unsafe.violations).toHaveLength(2); expect(unsafe.events[0]?.safe).toBe(false);
    expect(original).toEqual(before);
    const off = applyFurnaceAction(original, { type: 'furnace.use', target: 'serviceSwitch', tool: 'hand' });
    const gasOff = applyFurnaceAction(off, { type: 'furnace.use', target: 'gasCock', tool: 'hand' });
    const safe = applyFurnaceAction(gasOff, command);
    expect(safe.violations).toEqual([]); expect(safe.events[0]?.safe).toBe(true);
  });
  it('requires capacitor discharge and preserves the selected model rating', () => {
    const s = state(); s.furnace.controls.powerOn = false; s.furnace.capCharged = true;
    s.furnace.unit.ratedBlowerCapUf = 10;
    const command = { type: 'furnace.use', target: 'blowerCap', tool: 'part_blowercap' } as const;
    expect(applyFurnaceAction(s, command).events[0]?.safe).toBe(false);
    const discharged = applyFurnaceAction(s, { ...command, tool: 'discharge' });
    const repaired = applyFurnaceAction(discharged, command);
    expect(repaired.furnace.unit.blowerCapUf).toBeCloseTo(10.1);
    expect(repaired.events[0]?.safe).toBe(true);
  });
  it('never diagnoses a flame sensor from zero current with unlit burners', () => {
    expect(furnaceMeasurements(state(), { red: 'F_FS_ROD', black: 'F_BD_FS' }, 'ua', null)).toEqual([]);
  });
});

const cases: Array<{ id: string; fault: Partial<FurnaceParams>; repair?: [FurnaceTarget, ToolId] }> = [
  { id: 'f-orientation', fault: {} },
  { id: 'f-flame-sensor', fault: { flameSensorDirt: .9 }, repair: ['flameSensor', 'emery'] },
  { id: 'f-flame-sensor', fault: { flameSensorDirt: .9 }, repair: ['flameSensor', 'part_flamesensor'] },
  { id: 'f-igniter', fault: { igniterOhms: null }, repair: ['igniter', 'part_igniter'] },
  { id: 'f-inducer', fault: { inducerOhms: null }, repair: ['inducer', 'part_inducer'] },
  { id: 'f-pressure-switch', fault: { pressureSwitchOk: false }, repair: ['pressureSwitch', 'part_pswitch'] },
  { id: 'f-gas-off', fault: { gasCockOpen: false }, repair: ['gasCock', 'hand'] },
  { id: 'f-gas-valve', fault: { gasValveCoilOhms: null }, repair: ['gasValve', 'part_gasvalve'] },
  { id: 'f-filter', fault: { filterDirt: .9 }, repair: ['filter', 'part_filter'] },
  { id: 'f-blower-cap', fault: { blowerCapUf: 1.1 }, repair: ['blowerCap', 'part_blowercap'] },
  { id: 'f-fuse', fault: { fuseOk: false }, repair: ['fuse', 'part_fuse3a'] },
];
describe('complete furnace jobs through store, instruments, physics and procedure', () => {
  beforeEach(() => useSim.setState({ ...useSim.getInitialState(), sim: null, unitType: 'furnace', phase: 'running' }));
  it.each(cases)('$id $repair', ({ id, fault, repair }) => {
    useSim.setState({ furnace: createFurnace({ ...healthy, ...fault }, env) });
    click('burnerDoor'); click('blowerDoor'); click('doorSwitch');
    job().setThermostat({ mode: 'heat', setpointF: 70 });
    switch (id) {
      case 'f-orientation':
      case 'f-flame-sensor': meter('ua', 'F_FS_ROD', 'F_BD_FS'); break;
      case 'f-igniter': meter('vac', 'F_IGN_H', 'F_IGN_N'); break;
      case 'f-inducer': meter('vac', 'F_IND_H', 'F_IND_N'); break;
      case 'f-pressure-switch': meter('vac', 'F_PS_A', 'F_PS_B'); click('pressureTap', 'manometer'); break;
      case 'f-gas-off':
      case 'f-gas-valve': meter('vac', 'F_GV_MV', 'F_GV_C'); click('inletTap', 'manometer'); break;
      case 'f-filter': click('filter'); break;
      case 'f-blower-cap': meter('vac', 'F_BLW_H', 'F_BLW_N'); job().setTool('clamp'); job().clampWire('F_W_BLW'); break;
      case 'f-fuse': meter('vac', 'F_BD_SEC', 'F_BD_C'); meter('vac', 'F_BD_R', 'F_BD_C'); break;
    }
    if (id === 'f-orientation' || id === 'f-filter') { click('supplyDuct', 'thermo'); click('returnDuct', 'thermo'); }
    if (id === 'f-orientation' || id === 'f-gas-valve') click('manifoldTap', 'manometer');
    run(60);
    if (repair) {
      click('serviceSwitch'); meter('vac', 'F_SW_LOAD', 'F_SW_N');
      if (id === 'f-igniter') meter('ohm', 'F_IGN_H', 'F_IGN_N');
      if (id === 'f-inducer') meter('ohm', 'F_IND_H', 'F_IND_N');
      if (id === 'f-gas-valve') { meter('ohm', 'F_GV_MV', 'F_GV_C'); click('gasCock'); }
      if (id === 'f-blower-cap') { click('blowerCap', 'discharge'); meter('uf', 'F_BCAP_A', 'F_BCAP_B'); }
      click(...repair);
      if (id === 'f-gas-valve') click('gasCock');
      click('blowerDoor'); click('burnerDoor'); click('serviceSwitch');
      run(100);
    }
    const furnace = job().furnace!;
    expect(furnace.flame).toBe(true); expect(furnace.blower).toBe('running');
    expect(tempRiseF(furnace)).toBeGreaterThan(35); expect(tempRiseF(furnace)).toBeLessThan(65);
    expect(job().violations).toEqual([]);
    const procedure = procedureById(id + '-diagnosis')!;
    const completed = procedureProgress(procedure, job().equipmentJournal.events, true);
    expect(procedure.steps.filter((step) => !completed.has(step.id)).map((step) => step.label)).toEqual([]);
    expect(job().equipmentJournal.events.length).toBeLessThan(2000);
  });
});
