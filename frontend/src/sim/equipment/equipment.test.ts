import { beforeEach, describe, expect, it } from 'vitest';
import profile from '../../../../backend/app/equipment/goodman-gszb403610.json';
import type { EquipmentContext } from '../../api/types';
import { createSim } from '../engine';
import { useSim } from '../../store/useSim';
import { applyEquipmentAction } from './actions';
import { componentForTarget, componentForTerminal } from './registry';
import { procedureById, procedureProgress } from './procedures';
import type { EquipmentEvent, OutdoorActionState } from './types';

// Repository profiles omit fields filled by backend validation; model that API result here.
const context: EquipmentContext = { ...profile, schemaVersion: 1, systemType: 'heat_pump', unitType: 'condenser',
  supplyVolts: 230, contactorPoles: 1,
  heatPump: { ...profile.heatPump, defrostIntervalMinutes: 60 },
  refrigerant: 'R-410A', furnace: null, environment: { outdoorF: 95, indoorF: 78, setpointF: 72 },
  unit: { fuseL1Ok: true, fuseL2Ok: true, chargeFraction: 1, coilFouling: 0,
    contactor: { coilOhms: 12, pole1Ohms: .01, pole2Ohms: .01 },
    capacitor: profile.unit.capacitor,
    compressor: { ...profile.unit.compressor, runOhms: .9, startOhms: 2.4 },
    fanMotor: { ...profile.unit.fanMotor, runOhms: 38, auxOhms: 62, seized: false } },
};
const cap = 'system.outdoor.runCapacitor';
const procedure = procedureById('capacitor-start-diagnosis')!;
const sim = () => createSim(context.unit!, context.environment, context);
const actionState = (): OutdoorActionState => ({ sim: sim(), panels: { access: false, top: false, louver: false }, doorOpen: true });
const useCap = (state: OutdoorActionState, tool: 'discharge' | 'part_capacitor') => applyEquipmentAction(state, { type: 'component.use', componentId: cap, tool });

describe('equipment boundaries', () => {
  it('isolates nominal profiles and simultaneous runtime instances', () => {
    const original = structuredClone(context);
    const a = sim(); const b = sim();
    a.unit.capacitor.hermUf = 0;
    a.context!.heatPump!.smartShiftSeconds = 999;
    a.heatPump!.config.smartShiftSeconds = 777;
    a.service.addedLb = 5;
    expect(context).toEqual(original);
    expect(b.unit.capacitor.hermUf).toBe(original.unit!.capacitor.hermUf);
    expect(b.context).toEqual(original);
    expect(b.heatPump!.config.smartShiftSeconds).toBe(original.heatPump!.smartShiftSeconds);
    expect(b.service.addedLb).toBe(0);
  });

  it('maps scene targets and terminals to the same stable component', () => {
    expect(componentForTarget('condenser', 'capacitor')?.id).toBe(cap);
    expect(componentForTerminal('CAP_HERM')?.id).toBe(cap);
    expect(componentForTarget('furnace', 'capacitor')).toBeUndefined();
  });

  it('requires access, records unsafe repairs, and uses model ratings without mutation', () => {
    const state = actionState();
    const before = structuredClone(state.sim.unit);
    const blocked = useCap({ ...state, panels: { ...state.panels, access: true } }, 'part_capacitor');
    expect(blocked.repairs).toEqual([]);
    const unsafe = useCap(state, 'part_capacitor');
    expect(unsafe.violations).toHaveLength(1);
    expect(unsafe.events[0]?.safe).toBe(false);
    const isolated = applyEquipmentAction(state, { type: 'disconnect.toggle' });
    const discharged = useCap({ ...state, sim: { ...isolated.sim, capCharged: true } }, 'discharge');
    const repaired = useCap({ ...state, sim: discharged.sim }, 'part_capacitor');
    expect(repaired.violations).toEqual([]);
    expect(repaired.sim.unit.capacitor.hermUf).toBeCloseTo(40.32);
    expect(repaired.events[0]).toMatchObject({ type: 'component.replaced', componentId: cap, safe: true });
    expect(state.sim.unit).toEqual(before);
  });
});

describe('procedure evidence from actual store actions', () => {
  beforeEach(() => {
    useSim.setState({ ...useSim.getInitialState(), sim: sim(), furnace: null, phase: 'running', panels: { access: false, top: true, louver: true } });
  });
  const act = () => useSim.getState();
  function checks(): void {
    act().clickPullout();
    useSim.setState({ tool: 'multimeter' });
    act().probe('CAP_HERM'); act().probe('CAP_C');
    useSim.setState({ tool: 'discharge' });
    act().clickPart('capacitor');
    act().setMeterMode('uf');
    useSim.setState({ tool: 'part_capacitor' });
    act().clickPart('capacitor');
  }
  it('journals the complete path, tolerates reversed leads and checks operation only on submission', () => {
    checks();
    const events = act().equipmentJournal.events;
    expect(events.map((event) => event.type)).toEqual(['power.isolated', 'measurement.voltage', 'capacitor.discharged', 'measurement.capacitance', 'component.replaced']);
    expect(procedureProgress(procedure, events).size).toBe(5);
    expect(procedureProgress(procedure, events, true).size).toBe(6);
    expect(procedureProgress(procedure, [...events].reverse(), true)).toEqual(new Set(['isolate']));
  });
  it('invalidates safety prerequisites after power is restored', () => {
    checks();
    const events = act().equipmentJournal.events.slice(0, -1);
    const restart: EquipmentEvent[] = [
      { type: 'power.restored', componentId: 'system.outdoor.fuses', safe: true, t: 0 },
      { type: 'power.isolated', componentId: 'system.outdoor.fuses', safe: true, t: 0 },
      { type: 'component.replaced', componentId: cap, safe: true, t: 0 },
    ];
    expect(procedureProgress(procedure, [...events, ...restart], true).has('replace')).toBe(false);
  });
});
