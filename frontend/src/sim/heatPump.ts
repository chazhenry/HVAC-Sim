import type { HeatPumpConfig } from '../api/types';

export type DefrostStage = 'idle' | 'enter_delay' | 'defrost' | 'exit_delay';
export interface HeatPumpState {
  config: HeatPumpConfig;
  stage: DefrostStage;
  stageSeconds: number;
  heatingRunSeconds: number;
  coilF: number;
  sensorClosed: boolean;
  reversingValveEnergized: boolean;
  compressorPermitted: boolean;
  fanPermitted: boolean;
  auxiliaryHeat: boolean;
  indoorBlower: boolean;
  frost: number;
}

export const createHeatPump = (config: HeatPumpConfig, outdoorF: number): HeatPumpState => ({
  config, stage: 'idle', stageSeconds: 0, heatingRunSeconds: 0, coilF: outdoorF,
  sensorClosed: outdoorF <= config.sensorCloseF, reversingValveEnergized: false,
  compressorPermitted: true, fanPermitted: true, auxiliaryHeat: false, indoorBlower: false, frost: 0,
});

/** Time/temperature defrost state machine. Thermal ramps are training approximations. */
export function stepHeatPump(previous: HeatPumpState, input: {
  dt: number; mode: 'off' | 'cool' | 'heat'; calling: boolean; powered: boolean;
  compressorRunning: boolean; outdoorF: number;
}): { state: HeatPumpState; events: Array<'hp_defrost_start' | 'hp_defrost_end' | 'hp_shift'> } {
  const state = { ...previous };
  const events: Array<'hp_defrost_start' | 'hp_defrost_end' | 'hp_shift'> = [];
  const { config } = state;
  const heating = input.mode === 'heat' && input.calling && input.powered;
  state.stageSeconds += input.dt;
  if (!heating) {
    state.stage = 'idle'; state.stageSeconds = 0; state.heatingRunSeconds = 0;
  } else if (state.stage === 'idle') {
    if (input.compressorRunning && state.sensorClosed) state.heatingRunSeconds += input.dt;
    if (state.sensorClosed && state.heatingRunSeconds >= config.defrostIntervalMinutes * 60) {
      state.stage = 'enter_delay'; state.stageSeconds = 0; events.push('hp_shift');
    }
  } else if (state.stage === 'enter_delay' && state.stageSeconds >= config.smartShiftSeconds) {
    state.stage = 'defrost'; state.stageSeconds = 0; events.push('hp_defrost_start');
  } else if (state.stage === 'defrost' && (state.coilF >= config.sensorOpenF || state.stageSeconds >= config.maxDefrostSeconds)) {
    state.stage = 'exit_delay'; state.stageSeconds = 0; events.push('hp_defrost_end');
  } else if (state.stage === 'exit_delay' && state.stageSeconds >= config.smartShiftSeconds) {
    state.stage = 'idle'; state.stageSeconds = 0; state.heatingRunSeconds = 0; events.push('hp_shift');
  }
  const defrost = state.stage === 'defrost';
  const target = defrost && input.compressorRunning ? 90 : heating && input.compressorRunning ? input.outdoorF - 12 : input.outdoorF;
  state.coilF = target + (state.coilF - target) * Math.exp(-input.dt / (defrost ? 45 : 35));
  if (state.coilF <= config.sensorCloseF) state.sensorClosed = true;
  else if (state.coilF >= config.sensorOpenF) state.sensorClosed = false;
  state.reversingValveEnergized = input.mode === 'cool' || (heating && (state.stage === 'enter_delay' || defrost));
  state.compressorPermitted = state.stage === 'idle' || defrost;
  state.fanPermitted = state.stage === 'idle';
  state.auxiliaryHeat = heating && state.stage !== 'idle' && config.auxiliaryHeatKw > 0;
  state.indoorBlower = input.calling || state.auxiliaryHeat;
  state.frost = Math.max(0, Math.min(1, state.frost + (defrost ? -input.dt / 90 : heating && input.compressorRunning && state.coilF < 32 ? input.dt / 1800 : -input.dt / 300)));
  return { state, events };
}
