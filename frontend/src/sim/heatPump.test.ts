import { describe, expect, it } from 'vitest';
import type { EquipmentContext, HeatPumpConfig, UnitParams } from '../api/types';
import { createSim, resolve, stepSim, type SimState } from './engine';
import { probeVolts } from './instruments';
import { createHeatPump, stepHeatPump } from './heatPump';

const controls: HeatPumpConfig = { defrostIntervalMinutes: 60, smartShiftSeconds: 30,
  maxDefrostSeconds: 600, sensorCloseF: 31, sensorOpenF: 75, auxiliaryHeatKw: 5 };
const unit: UnitParams = { fuseL1Ok: true, fuseL2Ok: true,
  contactor: { coilOhms: 12, pole1Ohms: 0.01, pole2Ohms: 0.01 },
  capacitor: { ratedHermUf: 40, ratedFanUf: 5, hermUf: 40, fanUf: 5 },
  compressor: { runOhms: 0.9, startOhms: 2.4, rla: 16, lra: 91.9 },
  fanMotor: { runOhms: 38, auxOhms: 62, seized: false, fla: 0.97 }, chargeFraction: 1, coilFouling: 0 };
const context: EquipmentContext = { schemaVersion: 1, id: 'goodman-test', name: 'Goodman test',
  systemType: 'heat_pump', unitType: 'condenser', manufacturer: 'Goodman', outdoorModel: 'GSZB403610A',
  indoorModel: 'AMST36CU1400', refrigerant: 'R-410A', capacityBtuH: 36000, seer2: 14.3, hspf2: 7.5,
  supplyVolts: 230, contactorPoles: 1, minimumCircuitAmpacity: 21, maxOvercurrentAmps: 35,
  factoryChargeLb: 7.125, dimensionsM: { width: .9017, depth: .9017, height: 1.006475 }, cabinetColor: '#767a75',
  environment: { outdoorF: 28, indoorF: 68, setpointF: 72 }, unit, furnace: null, heatPump: controls, sources: [], notes: '' };

function run(state: SimState, seconds: number): SimState {
  for (let n = 0; n < seconds * 10; n++) state = stepSim(state, .1).state;
  return state;
}
function calling(mode: 'heat' | 'cool'): SimState {
  const state = createSim(unit, mode === 'heat' ? context.environment : { outdoorF: 95, indoorF: 78, setpointF: 72 }, context);
  return resolve({ ...state, controls: { ...state.controls, calling: true, mode } });
}

describe('single-stage heat pump', () => {
  it('does not accumulate defrost runtime with a stopped compressor and cancels when the call ends', () => {
    const initial = createHeatPump(controls, 28);
    const input = { dt: 100, mode: 'heat' as const, calling: true, powered: true, compressorRunning: false, outdoorF: 28 };
    const stopped = stepHeatPump(initial, input).state;
    expect(stopped.heatingRunSeconds).toBe(0);
    const cancelled = stepHeatPump({ ...stopped, stage: 'defrost', auxiliaryHeat: true }, { ...input, calling: false }).state;
    expect(cancelled.stage).toBe('idle');
    expect(cancelled.auxiliaryHeat).toBe(false);
    expect(cancelled.indoorBlower).toBe(false);
  });

  it('terminates defrost on the maximum timer even when the sensor never opens', () => {
    const initial = createHeatPump({ ...controls, maxDefrostSeconds: 60 }, 28);
    const result = stepHeatPump({ ...initial, stage: 'defrost', stageSeconds: 60 }, {
      dt: .1, mode: 'heat', calling: true, powered: true, compressorRunning: true, outdoorF: 28,
    });
    expect(result.state.stage).toBe('exit_delay');
    expect(result.events).toContain('hp_defrost_end');
  });
  it('runs the cooling chain with O energized and the configured supply voltage', () => {
    const state = run(calling('cool'), 8);
    expect(state.compressor).toBe('running');
    expect(state.fan).toBe('running');
    expect(probeVolts(state, 'HP_O', 'HP_C')).toBeCloseTo(24, 1);
    expect(probeVolts(state, 'CONT_L1', 'CONT_L2')).toBeCloseTo(230, 0);
  });

  it('heats with O de-energized, indoor blower running and a hot vapor line', () => {
    const state = run(calling('heat'), 60);
    expect(state.compressor).toBe('running');
    expect(state.fan).toBe('running');
    expect(state.fanSpeed).toBeGreaterThan(.9);
    expect(state.heatPump?.indoorBlower).toBe(true);
    expect(state.heatPump?.sensorClosed).toBe(true);
    expect(probeVolts(state, 'HP_O', 'HP_C')).toBeCloseTo(0, 2);
    expect(state.thermo.suctionLineF).toBeGreaterThan(100);
  });

  it('defrosts through shift delays, fan stop, O and W2 outputs, then resumes heating', () => {
    let state = run(calling('heat'), 60);
    state = { ...state, heatPump: { ...state.heatPump!, heatingRunSeconds: 3600 } };
    state = run(state, 2);
    expect(state.heatPump?.stage).toBe('enter_delay');
    expect(state.compressor).toBe('off');
    state = run(state, 30);
    expect(state.heatPump?.stage).toBe('defrost');
    expect(state.compressor).toBe('running');
    expect(state.fan).toBe('off');
    expect(probeVolts(state, 'HP_O', 'HP_C')).toBeCloseTo(24, 1);
    expect(probeVolts(state, 'HP_W2', 'HP_C')).toBeCloseTo(24, 1);
    state = run(state, 150);
    expect(state.heatPump?.stage).toBe('idle');
    expect(state.compressor).toBe('running');
    expect(state.fan).toBe('running');
    expect(state.heatPump?.auxiliaryHeat).toBe(false);
    expect(state.heatPump?.reversingValveEnergized).toBe(false);
  });

  it('keeps L2 live through a single-pole contactor until the disconnect is pulled', () => {
    let state = createSim(unit, context.environment, context);
    expect(probeVolts(state, 'CONT_T2', 'GND_LUG')).toBeGreaterThan(100);
    state = resolve({ ...state, controls: { ...state.controls, disconnectIn: false } });
    expect(probeVolts(state, 'CONT_T2', 'GND_LUG')).toBeLessThan(1);
  });
});
