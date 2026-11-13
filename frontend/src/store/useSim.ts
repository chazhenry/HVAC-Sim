import { applyFurnaceAction } from '../sim/equipment/furnaceActions';
import { furnaceMeasurements } from '../sim/equipment/furnaceMeasurements';
import { create } from 'zustand';
import { applyEquipmentAction } from '../sim/equipment/actions';
import { componentForTarget, componentForTerminal } from '../sim/equipment/registry';
import type { EquipmentAction, EquipmentEvent, EquipmentJournal } from '../sim/equipment/types';
import { api } from '../api/client';
import type {
  CatalogResponse,
  EquipmentContext,
  GradeResponse,
  RepairAction,
  ScenarioSummary,
  SubmitRequest,
  UnitType,
} from '../api/types';
import {
  createSim,
  liquidPsig,
  resolve,
  type SimEvent,
  type SimState,
  stepSim,
  subcoolF,
  suctionPsig,
  superheatF,
} from '../sim/engine';
import {
  createFurnace,
  type FEvent,
  type FurnaceState,
  manifoldWc,
  resolveFurnace,
  stepFurnace,
  tempRiseF,
} from '../sim/furnace/engine';
import { fIsHot, fProbeVolts, fReadClamp, fReadMeter } from '../sim/furnace/instruments';
import { isHot, type MeterMode, type MeterReading, probeVolts, readClamp, readMeter } from '../sim/instruments';
import {
  ATMOSPHERE_MICRONS,
  type CenterHose,
  FACTORY_CHARGE_LB,
  NAMEPLATE_TEST_PSIG,
  type ServiceState,
} from '../sim/service';
import {
  type AnyClampId,
  type AnyEnclosure,
  type AnyTestPointId,
  clampLabel,
  isFurnaceClamp,
  isFurnacePoint,
  pointInfo,
} from '../sim/points';

export type { ToolId } from '../sim/equipment/types';
import type { ToolId } from '../sim/equipment/types';

export type PanelId = 'access' | 'louver' | 'top';
export type PartTarget = 'capacitor' | 'contactor' | 'fanMotor' | 'fuses' | 'coil';
export type { FurnaceDoor, ManometerTap, FurnaceTarget } from '../sim/equipment/types';
import type { FurnaceDoor, ManometerTap, FurnaceTarget } from '../sim/equipment/types';
export type Phase = 'loading' | 'menu' | 'running' | 'graded';
export type LogKind = 'info' | 'sound' | 'warn' | 'danger' | 'good';

export interface LogEntry {
  id: number;
  t: number;
  text: string;
  kind: LogKind;
}

const PANEL_NAMES: Record<PanelId, string> = {
  access: 'electrical access panel',
  louver: 'front louver panel',
  top: 'fan top',
};

const EVENT_TEXT: Record<SimEvent, readonly [LogKind, string]> = {
  hp_defrost_start: ['info', 'Defrost: O energized, outdoor fan stopped, auxiliary heat on.'],
  hp_defrost_end: ['good', 'Defrost complete. Compressor pauses for the return to heating.'],
  hp_shift: ['sound', 'Defrost controller changes sequence state (SmartShift).'],
  contactor_in: ['sound', 'Click - the contactor pulls in.'],
  contactor_out: ['sound', 'Clack - the contactor drops out.'],
  compressor_start: ['sound', 'The compressor starts and settles into a steady drone.'],
  compressor_stall: ['sound', 'A loud hum from the compressor - it is not turning.'],
  compressor_stop: ['sound', 'The compressor winds down.'],
  overload_trip: ['sound', 'Tick - the hum stops. Something inside the compressor opened.'],
  overload_reset: ['sound', 'A faint tick from the compressor shell.'],
  fan_start: ['sound', 'The condenser fan spins up.'],
  fan_stall: ['sound', 'The fan motor buzzes but the blade does not turn.'],
  fan_stop: ['sound', 'The condenser fan coasts down.'],
  hps_trip: ['warn', 'The unit shuts off abruptly under load.'],
  hps_reset: ['info', 'A pressure switch resets.'],
  lps_trip: ['warn', 'The unit shuts off - suction pressure has collapsed.'],
  lps_reset: ['info', 'A pressure switch resets.'],
  svc_zero: ['good', 'The gauges reach 0 psig - the charge is out of the system.'],
  svc_500: ['good', 'The micron gauge drops through 500 microns.'],
  svc_hold_pass: ['good', 'Standing vacuum test: the reading has levelled off under 500 microns. Dry and tight.'],
  svc_hold_fail: ['warn', 'Standing vacuum test: the reading crept back above 500 microns and levelled off.'],
  svc_overfill: ['danger', 'The recovery cylinder is past 80% full.'],
};

const HOSE_TEXT: Record<CenterHose, string> = {
  none: 'Yellow hose capped.',
  recovery: 'Yellow hose on the recovery machine, which feeds the recovery cylinder on the scale.',
  nitrogen: 'Yellow hose on the nitrogen regulator.',
  vacuum: 'Yellow hose on the vacuum pump, micron gauge teed in.',
  cylinder: 'Yellow hose on the R-410A cylinder, sitting on the charging scale.',
};

const F_EVENT_TEXT: Record<FEvent, readonly [LogKind, string]> = {
  inducer_start: ['sound', 'The inducer (draft fan) whirs up.'],
  inducer_stop: ['sound', 'The inducer winds down.'],
  ps_close: ['sound', 'A soft click from the pressure switch.'],
  igniter_glow: ['info', 'The igniter glows bright orange.'],
  gas_click: ['sound', 'Clunk - the gas valve pulls in.'],
  burners_light: ['sound', 'Whoosh - the burners light with a steady blue flame.'],
  burners_out: ['sound', 'The burners go out.'],
  blower_start: ['sound', 'The main blower comes on and air starts moving.'],
  blower_stall: ['sound', 'A heavy hum from the blower compartment - the wheel is not turning.'],
  blower_stop: ['sound', 'The blower coasts down.'],
  limit_trip: ['warn', 'Something clicks on the heat exchanger and the burners shut off.'],
  limit_reset: ['info', 'A click from the heat exchanger as it cools.'],
  lockout: ['warn', 'The furnace stops trying. The board LED starts flashing.'],
  code_ps_open: ['warn', 'The board LED starts flashing.'],
  code_ps_closed: ['warn', 'The board LED starts flashing.'],
};

export type TstatMode = 'off' | 'cool' | 'heat';
export type TstatStyle = 'digital' | 'smart';
export const TSTAT_MIN_F = 50;
export const TSTAT_MAX_F = 90;

const STYLE_KEY = 'hvac-sim.thermostat-style';

/** The face the learner last picked; a per-browser convenience only. */
function savedStyle(): TstatStyle {
  try {
    return window.localStorage.getItem(STYLE_KEY) === 'smart' ? 'smart' : 'digital';
  } catch {
    return 'digital';
  }
}

export interface AppState {
  phase: Phase;
  error: string | null;
  busy: boolean;
  catalog: CatalogResponse | null;
  sessionId: string | null;
  scenario: ScenarioSummary | null;
  unitType: UnitType;
  context: EquipmentContext | null;
  procedureId: string | null;
  /** Condenser simulation (null on a furnace job). */
  sim: SimState | null;
  /** Furnace simulation (null on a condenser job). */
  furnace: FurnaceState | null;

  /** Wall thermostat. It calls only when its mode is on and the room is past the setpoint. */
  tstat: { mode: TstatMode; setpointF: number };
  tstatStyle: TstatStyle;
  tool: ToolId;
  meterMode: MeterMode;
  leads: { red: AnyTestPointId | null; black: AnyTestPointId | null };
  nextLead: 'red' | 'black';
  clampAt: AnyClampId | null;
  ncvAt: AnyTestPointId | null;
  gauges: { low: boolean; high: boolean };
  tempClamps: { suction: boolean; liquid: boolean };
  /** true = fitted to the unit. */
  panels: Record<PanelId, boolean>;
  doorOpen: boolean;
  /** Furnace doors; true = fitted. */
  fdoors: Record<FurnaceDoor, boolean>;
  doorSwitchTaped: boolean;
  manoAt: ManometerTap | null;
  probes: { supply: boolean; return: boolean };

  repairs: RepairAction[];
  violations: string[];
  measurements: number;
  hints: string[];
  hintsTotal: number;
  log: LogEntry[];
  hover: string | null;
  result: GradeResponse | null;
  equipmentJournal: EquipmentJournal;

  loadCatalog: () => Promise<void>;
  startScenario: (id: string, context?: EquipmentContext) => Promise<void>;
  testDefrost: () => void;
  backToMenu: () => void;
  tick: (dt: number) => void;
  setTool: (tool: ToolId) => void;
  setHover: (text: string | null) => void;
  setMeterMode: (mode: MeterMode) => void;
  clearLeads: () => void;
  setThermostat: (patch: Partial<{ mode: TstatMode; setpointF: number }>) => void;
  setTstatStyle: (style: TstatStyle) => void;
  clickPanel: (id: PanelId) => void;
  clickDoor: () => void;
  clickPullout: () => void;
  probe: (id: AnyTestPointId) => void;
  clampWire: (id: AnyClampId) => void;
  clickPort: (side: 'low' | 'high') => void;
  clickPipe: (line: 'suction' | 'liquid') => void;
  clickPart: (target: PartTarget) => void;
  clickFurnace: (target: FurnaceTarget) => void;
  serviceHose: (hose: CenterHose) => void;
  serviceToggle: () => void;
  serviceRelease: () => void;
  serviceOpen: () => void;
  serviceSet: (patch: Pick<Partial<ServiceState>, 'regulatorPsig' | 'testGas'>) => void;
  requestHint: () => Promise<void>;
  submit: (diagnosisId: string) => Promise<void>;
  isAccessible: (enclosure: AnyEnclosure) => boolean;
}

// ---- instrument readings for whichever unit is on the bench ----------------

export function activeVolts(s: AppState, a: AnyTestPointId, b: AnyTestPointId): number {
  if (s.furnace && isFurnacePoint(a) && isFurnacePoint(b)) return fProbeVolts(s.furnace, a, b);
  if (s.sim && !isFurnacePoint(a) && !isFurnacePoint(b)) return probeVolts(s.sim, a, b);
  return 0;
}

export function activeReading(s: AppState): MeterReading {
  const { red, black } = s.leads;
  if (s.furnace) {
    return fReadMeter(
      s.furnace,
      s.meterMode,
      red !== null && isFurnacePoint(red) ? red : null,
      black !== null && isFurnacePoint(black) ? black : null,
    );
  }
  if (s.sim) {
    return readMeter(
      s.sim,
      s.meterMode,
      red !== null && !isFurnacePoint(red) ? red : null,
      black !== null && !isFurnacePoint(black) ? black : null,
    );
  }
  return { kind: 'idle' };
}

export function activeHot(s: AppState, id: AnyTestPointId): boolean {
  if (isFurnacePoint(id)) return s.furnace !== null && fIsHot(s.furnace, id);
  return s.sim !== null && isHot(s.sim, id);
}

export function activeClamp(s: AppState, id: AnyClampId): number {
  if (isFurnaceClamp(id)) return s.furnace ? fReadClamp(s.furnace, id) : 0;
  return s.sim ? readClamp(s.sim, id) : 0;
}

/** Simulated seconds on the job clock. */
export const activeTime = (s: AppState): number => s.sim?.t ?? s.furnace?.t ?? 0;

let logId = 0;

const fresh = {
  tstat: { mode: 'off' as TstatMode, setpointF: 72 },
  tool: 'hand' as ToolId,
  meterMode: 'vac' as MeterMode,
  leads: { red: null, black: null },
  nextLead: 'red' as const,
  clampAt: null,
  ncvAt: null,
  gauges: { low: false, high: false },
  tempClamps: { suction: false, liquid: false },
  panels: { access: true, louver: true, top: true },
  doorOpen: false,
  fdoors: { burner: true, blower: true },
  doorSwitchTaped: false,
  manoAt: null,
  probes: { supply: false, return: false },
  repairs: [] as RepairAction[],
  violations: [] as string[],
  measurements: 0,
  hints: [] as string[],
  hintsTotal: 0,
  log: [] as LogEntry[],
  hover: null,
  result: null,
  equipmentJournal: { schemaVersion: 1, events: [] } as EquipmentJournal,
};

export const useSim = create<AppState>()((set, get) => {
  const say = (text: string, kind: LogKind = 'info'): void => {
    const t = activeTime(get());
    set((s) => ({ log: [...s.log, { id: ++logId, t, text, kind }].slice(-80) }));
  };

  const violation = (text: string): void => {
    set((s) => ({ violations: [...s.violations, text] }));
    say(`UNSAFE: ${text}`, 'danger');
  };

  const addRepair = (repair: RepairAction): void => {
    set((s) => (s.repairs.includes(repair) ? {} : { repairs: [...s.repairs, repair] }));
  };

  const appendEquipmentEvents = (events: readonly EquipmentEvent[]): void => {
    if (!events.length) return;
    set((state) => ({ equipmentJournal: { schemaVersion: 1, events: [...state.equipmentJournal.events, ...events] } }));
  };

  const runEquipmentAction = (action: EquipmentAction): void => {
    const state = get();
    if (!state.sim) return;
    const result = applyEquipmentAction({ sim: state.sim, panels: state.panels, doorOpen: state.doorOpen }, action);
    set({ sim: result.sim });
    appendEquipmentEvents(result.events);
    for (const unsafe of result.violations) violation(unsafe);
    for (const repair of result.repairs) addRepair(repair);
    for (const message of result.messages) say(message.text, message.kind);
  };

  const recordEquipmentMeasurement = (force = true): void => {
    const state = get();
    const { sim, leads, meterMode } = state;
    if (state.furnace) {
      const events = furnaceMeasurements({ ...state, furnace: state.furnace }, state.leads, state.meterMode, state.clampAt);
      // Keep changed readings from connected instruments, including transient ignition signals.
      const fresh = events.filter((event) => {
        const previous = [...state.equipmentJournal.events].reverse().find((item) => item.type === event.type && item.componentId === event.componentId
          && item.channel === event.channel && JSON.stringify(item.terminals ?? []) === JSON.stringify(event.terminals ?? []));
        const tolerance = event.unit === '°F' ? .5 : event.unit === 'A' ? .1 : .02;
        return force || !previous || previous.safe !== event.safe || previous.status !== event.status
          || (previous.value === undefined) !== (event.value === undefined)
          || previous.value !== undefined && event.value !== undefined && Math.abs(previous.value - event.value) >= tolerance;
      });
      appendEquipmentEvents(fresh);
      return;
    }
    if (!sim || !leads.red || !leads.black) return;
    const component = componentForTerminal(leads.red);
    if (!component || componentForTerminal(leads.black)?.id !== component.id) return;
    const reading = activeReading(state);
    if (reading.kind !== 'value' || (reading.unit !== 'V' && reading.unit !== 'µF')) return;
    appendEquipmentEvents([{
      type: meterMode === 'vac' ? 'measurement.voltage' : 'measurement.capacitance',
      componentId: component.id, t: sim.t, value: reading.value, unit: reading.unit,
      terminals: [leads.red, leads.black],
      safe: reading.unit === 'V' || (!sim.controls.disconnectIn && !sim.capCharged),
    }]);
  };

  const needTool = (wanted: ToolId, text: string): boolean => {
    if (get().tool === wanted) return true;
    say(text);
    return false;
  };

  /** Ohms and capacitance must never be used on an energised or charged part. */
  const checkMeterSafety = (): void => {
    const s = get();
    const { meterMode, leads } = s;
    if ((meterMode !== 'ohm' && meterMode !== 'uf') || leads.red === null || leads.black === null) return;
    const name = meterMode === 'ohm' ? 'resistance' : 'capacitance';
    if (activeVolts(s, leads.red, leads.black) > 3) {
      violation(`Meter set to ${name} on a live circuit`);
      return;
    }
    const onCap = pointInfo(leads.red).onCapacitor || pointInfo(leads.black).onCapacitor;
    const charged = s.sim?.capCharged ?? s.furnace?.capCharged ?? false;
    if (onCap && charged) violation('Tested the capacitor without discharging it first');
  };

  const dropLeadsIn = (enclosure: AnyEnclosure): void => {
    const inside = (id: AnyTestPointId | null): boolean => id !== null && pointInfo(id).enclosure === enclosure;
    set((s) => ({
      leads: {
        red: inside(s.leads.red) ? null : s.leads.red,
        black: inside(s.leads.black) ? null : s.leads.black,
      },
      ncvAt: inside(s.ncvAt) ? null : s.ncvAt,
      clampAt: enclosure === 'disconnect' || enclosure === 'compressor' ? s.clampAt : null,
    }));
  };

  return {
    phase: 'loading',
    error: null,
    busy: false,
    catalog: null,
    sessionId: null,
    scenario: null,
    unitType: 'condenser',
    context: null,
    procedureId: null,
    sim: null,
    furnace: null,
    tstatStyle: savedStyle(),
    ...fresh,

    loadCatalog: async () => {
      try {
        const catalog = await api.catalog();
        set({ catalog, phase: 'menu', error: null });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e), phase: 'menu' });
      }
    },

    startScenario: async (id, context) => {
      set({ busy: true, error: null });
      try {
        const session = await api.startSession(id, context);
        const common = {
          ...fresh,
          equipmentJournal: { schemaVersion: 1 as const, events: [] },
          busy: false,
          phase: 'running' as const,
          sessionId: session.sessionId,
          scenario: session.scenario,
          unitType: session.unitType,
          context: session.context,
          procedureId: session.procedureId,
          tstat: { mode: 'off' as TstatMode, setpointF: Math.round(session.environment.setpointF) },
        };
        if (session.unitType === 'furnace') {
          set({ ...common, sim: null, furnace: createFurnace(session.furnace, session.environment) });
          say('You arrive on site. The furnace has power and the thermostat is off.');
        } else {
          set({ ...common, furnace: null, sim: createSim(session.unit, session.environment, session.context) });
          say('You arrive on site. The disconnect is in and the thermostat is off.');
        }
      } catch (e) {
        set({ busy: false, error: e instanceof Error ? e.message : String(e) });
      }
    },

    backToMenu: () =>
      set({ ...fresh, equipmentJournal: { schemaVersion: 1, events: [] }, phase: 'menu', sim: null, furnace: null, sessionId: null, scenario: null, context: null, procedureId: null }),

    testDefrost: () => {
      const { sim } = get();
      if (!sim?.heatPump || sim.controls.mode !== 'heat' || !sim.controls.calling || !sim.heatPump.sensorClosed || sim.compressor !== 'running') {
        say('Defrost TEST needs a running heat call and a closed cold-coil sensor.');
        return;
      }
      if (sim.heatPump.stage !== 'idle') return;
      set({ sim: { ...sim, heatPump: { ...sim.heatPump, heatingRunSeconds: sim.heatPump.config.defrostIntervalMinutes * 60 } } });
      say('Defrost board TEST: advanced the interval timer.');
    },

    tick: (dt) => {
      const { sim, furnace, phase } = get();
      if (phase !== 'running') return;
      if (sim) {
        const { state, events } = stepSim(sim, dt);
        set({ sim: state });
        if (state.service.addedLb > sim.service.addedLb) addRepair('add_refrigerant');
        if (state.service.recoveredLb > sim.service.recoveredLb) addRepair('recover_refrigerant');
        for (const e of events) {
          if (e === 'svc_overfill') violation('Filled the recovery cylinder past 80%');
          else say(EVENT_TEXT[e][1], EVENT_TEXT[e][0]);
        }
      } else if (furnace) {
        const { state, events } = stepFurnace(furnace, dt);
        set({ furnace: state });
        for (const e of events) say(F_EVENT_TEXT[e][1], F_EVENT_TEXT[e][0]);
        if (Math.floor(state.t) !== Math.floor(furnace.t) || state.flame !== furnace.flame) recordEquipmentMeasurement(false);
      }
    },

    setTool: (tool) => set({ tool, hover: null }),
    setHover: (hover) => set({ hover }),

    setMeterMode: (meterMode) => {
      set({ meterMode });
      checkMeterSafety();
      recordEquipmentMeasurement();
    },

    clearLeads: () => set({ leads: { red: null, black: null }, nextLead: 'red' }),

    setThermostat: (patch) => {
      const { sim, furnace, tstat: before } = get();
      const unit = sim ?? furnace;
      if (!unit) return;
      const tstat = { ...before, ...patch };
      tstat.setpointF = Math.min(TSTAT_MAX_F, Math.max(TSTAT_MIN_F, Math.round(tstat.setpointF)));
      if (tstat.mode === before.mode && tstat.setpointF === before.setpointF) return;
      const roomF = unit.env.indoorF;
      const calling =
        tstat.mode === 'cool' ? roomF > tstat.setpointF : tstat.mode === 'heat' ? roomF < tstat.setpointF : false;
      const changed = calling !== unit.controls.calling;
      set({ tstat });
      if (sim) set({ sim: resolve({ ...sim, controls: { ...sim.controls,
        calling: sim.heatPump ? calling : tstat.mode === 'cool' && calling, mode: tstat.mode } }) });
      else if (changed && furnace) set({ furnace: resolveFurnace({ ...furnace, controls: { ...furnace.controls, calling } }) });
      // Stepping the setpoint without crossing room temperature is not worth a log line.
      if (!changed && tstat.mode === before.mode) return;
      if (tstat.mode === 'off') {
        say('Thermostat set to OFF.');
        return;
      }
      const name = tstat.mode === 'heat' ? 'HEAT' : 'COOL';
      say(
        calling
          ? `Thermostat set to ${name} at ${tstat.setpointF} °F - calling for ${tstat.mode === 'heat' ? 'heat' : 'cooling'}.`
          : `Thermostat set to ${name} at ${tstat.setpointF} °F - the room is ${roomF.toFixed(0)} °F, so it is not calling.`,
      );
    },

    setTstatStyle: (tstatStyle) => {
      set({ tstatStyle });
      try {
        window.localStorage.setItem(STYLE_KEY, tstatStyle);
      } catch {
        // Storage can be blocked; the choice then lasts for this visit only.
      }
    },

    isAccessible: (enclosure) => {
      const { panels, doorOpen, fdoors } = get();
      switch (enclosure) {
        case 'controlBox':
          return !panels.access;
        case 'compressor':
          return !panels.top;
        case 'disconnect':
          return doorOpen;
        case 'burner':
          return !fdoors.burner;
        case 'blower':
          return !fdoors.blower;
        case 'switchBox':
          return true;
      }
    },

    clickPanel: (id) => {
      if (!needTool('nutdriver', `Select the nut driver to remove or refit the ${PANEL_NAMES[id]}.`)) return;
      const fitted = !get().panels[id];
      set((s) => ({ panels: { ...s.panels, [id]: fitted } }));
      if (fitted && id === 'access') dropLeadsIn('controlBox');
      if (fitted && id === 'top') dropLeadsIn('compressor');
      if (id === 'top') {
        say(
          fitted
            ? 'Lowered the fan top and ran the screws back in.'
            : 'Swung the fan top up - the fan wiring stays connected.',
        );
      } else say(fitted ? `Refitted the ${PANEL_NAMES[id]}.` : `Removed the ${PANEL_NAMES[id]}.`);
    },

    clickDoor: () => {
      if (!needTool('hand', 'Select the hand to open or close the disconnect.')) return;
      const doorOpen = !get().doorOpen;
      set({ doorOpen });
      if (!doorOpen) dropLeadsIn('disconnect');
      say(doorOpen ? 'Opened the disconnect cover.' : 'Closed the disconnect cover.');
    },

    clickPullout: () => {
      if (!needTool('hand', 'Select the hand to pull or insert the disconnect.')) return;
      runEquipmentAction({ type: 'disconnect.toggle' });
    },

    probe: (id) => {
      const { tool } = get();
      if (tool === 'multimeter') {
        const { leads, nextLead } = get();
        if (leads.red === id) set({ leads: { ...leads, red: null }, nextLead: 'red' });
        else if (leads.black === id) set({ leads: { ...leads, black: null }, nextLead: 'black' });
        else {
          const slot = leads.red === null ? 'red' : leads.black === null ? 'black' : nextLead;
          const placed = { ...leads, [slot]: id };
          set({ leads: placed, nextLead: slot === 'red' ? 'black' : 'red' });
          if (placed.red !== null && placed.black !== null) {
            set((s) => ({ measurements: s.measurements + 1 }));
            checkMeterSafety();
            recordEquipmentMeasurement();
          }
        }
      } else if (tool === 'ncv') {
        const same = get().ncvAt === id;
        set((s) => ({ ncvAt: same ? null : id, measurements: s.measurements + (same ? 0 : 1) }));
      } else if (tool === 'discharge' && pointInfo(id).onCapacitor) {
        if (isFurnacePoint(id)) get().clickFurnace('blowerCap');
        else get().clickPart('capacitor');
      } else {
        say('Select the multimeter or the voltage tester to probe a terminal.');
      }
    },

    clampWire: (id) => {
      if (!needTool('clamp', 'Select the clamp meter to measure current on a wire.')) return;
      const same = get().clampAt === id;
      set((s) => ({ clampAt: same ? null : id, measurements: s.measurements + (same ? 0 : 1) }));
      if (!same) { say(`Clamp meter around: ${clampLabel(id)}.`); recordEquipmentMeasurement(); }
    },

    clickPort: (side) => {
      if (!needTool('gauges', 'Select the manifold gauges to connect a hose to a service port.')) return;
      const on = !get().gauges[side];
      set((s) => ({
        gauges: { ...s.gauges, [side]: on },
        measurements: s.measurements + (on ? 1 : 0),
      }));
      const name = side === 'low' ? 'Blue hose on the suction port' : 'Red hose on the liquid port';
      say(on ? `${name}.` : `${name} removed.`);
    },

    clickPipe: (line) => {
      if (!needTool('tempclamp', 'Select the temperature clamps to clamp a refrigerant line.')) return;
      const on = !get().tempClamps[line];
      set((s) => ({
        tempClamps: { ...s.tempClamps, [line]: on },
        measurements: s.measurements + (on ? 1 : 0),
      }));
      say(`Temperature clamp ${on ? 'on' : 'off'} the ${line} line.`);
    },

    clickPart: (target) => {
      const component = componentForTarget('condenser', target);
      if (component) runEquipmentAction({ type: 'component.use', componentId: component.id, tool: get().tool });
    },

    clickFurnace: (target) => {
      const state = get();
      if (!state.furnace) return;
      const result = applyFurnaceAction({ ...state, furnace: state.furnace }, { type: 'furnace.use', target, tool: state.tool });
      set({ furnace: result.furnace, fdoors: result.fdoors, doorSwitchTaped: result.doorSwitchTaped,
        manoAt: result.manoAt, probes: result.probes, measurements: state.measurements + result.measurements });
      for (const door of result.dropLeads) dropLeadsIn(door);
      appendEquipmentEvents(result.events);
      for (const unsafe of result.violations) violation(unsafe);
      for (const repair of result.repairs) addRepair(repair);
      for (const message of result.messages) say(message.text, message.kind);
      recordEquipmentMeasurement();
    },

    serviceHose: (hose) => {
      const { sim, gauges } = get();
      if (!sim) return;
      if (hose !== 'none' && !(gauges.low && gauges.high)) {
        say('Connect both gauge hoses to the service ports first.');
        return;
      }
      set({ sim: { ...sim, service: { ...sim.service, hose, running: false } } });
      say(HOSE_TEXT[hose]);
    },

    serviceToggle: () => {
      const { sim } = get();
      if (!sim) return;
      const svc = sim.service;
      const charge = sim.unit.chargeFraction;
      const pressure = svc.staticPsig ?? 0;
      const run = (running: boolean): void => set({ sim: { ...sim, service: { ...svc, running } } });
      if (svc.running) {
        run(false);
        say(svc.hose === 'vacuum' ? 'Pump valved off and stopped. Watch the micron gauge.' : 'Stopped - valve closed.');
        return;
      }
      switch (svc.hose) {
        case 'none':
          return;
        case 'recovery':
          run(true);
          say('Recovery machine running - refrigerant is moving into the recovery cylinder.');
          return;
        case 'nitrogen':
          if (charge > 0) {
            say('There is still refrigerant in the system. Recover it before pressurising.', 'warn');
            return;
          }
          if (svc.testGas === 'oxygen') {
            violation('Tried to pressurise a refrigerant circuit with oxygen - oil and oxygen explode');
            return;
          }
          if (svc.testGas === 'air') violation('Pressure tested with compressed air - it adds moisture and oxygen');
          if (svc.regulatorPsig > NAMEPLATE_TEST_PSIG) violation('Exceeded the nameplate test pressure');
          run(true);
          say(`Pressurising to ${svc.regulatorPsig} psig through the regulator.`);
          return;
        case 'vacuum':
          if (charge > 0 || pressure > 1) {
            violation('Started the vacuum pump on a pressurised system');
            return;
          }
          run(true);
          say('Vacuum pump running.');
          return;
        case 'cylinder':
          if (charge === 0 && pressure > 1) {
            say('Release the nitrogen and evacuate before charging.', 'warn');
            return;
          }
          run(true);
          say(
            sim.compressor === 'running'
              ? 'Cylinder valve open - metering refrigerant into the suction side.'
              : 'Cylinder valve open - weighing refrigerant in with the unit off.',
          );
          return;
      }
    },

    serviceRelease: () => {
      const { sim } = get();
      if (!sim) return;
      if (sim.unit.chargeFraction > 0) {
        say('That is refrigerant, not nitrogen - it must be recovered, never released.', 'warn');
        return;
      }
      set({ sim: { ...sim, service: { ...sim.service, staticPsig: 0, running: false } } });
      say('Nitrogen released. Gauges back to 0 psig.');
    },

    serviceOpen: () => {
      const { sim } = get();
      if (!sim) return;
      const svc = sim.service;
      const charge = sim.unit.chargeFraction;
      const pressure = svc.staticPsig ?? 999;
      if (sim.controls.disconnectIn) violation('Opened the refrigerant circuit with the disconnect in');
      if (charge > 0) violation('Vented refrigerant - opened the system while it still held a charge');
      set({
        sim: resolve({
          ...sim,
          unit: { ...sim.unit, chargeFraction: 0 },
          service: {
            ...svc,
            running: false,
            opened: true,
            openedAtPsig: charge > 0 ? pressure : Math.min(pressure, 0),
            staticPsig: 0,
            nonCondensables: false,
            moisture: 1,
            microns: ATMOSPHERE_MICRONS,
            deepestMicrons: ATMOSPHERE_MICRONS,
            holdBase: null,
            heldFor: 0,
            heldMicrons: null,
          },
        }),
      });
      addRepair('replace_filter_drier');
      say('Cut out the old filter drier and brazed in a new one. The system has been open to the air.', 'good');
    },

    serviceSet: (patch) => {
      const { sim } = get();
      if (sim) set({ sim: { ...sim, service: { ...sim.service, ...patch } } });
    },

    requestHint: async () => {
      const { sessionId } = get();
      if (!sessionId) return;
      try {
        const res = await api.hint(sessionId);
        set((s) => ({
          hints: s.hints.includes(res.hint) ? s.hints : [...s.hints, res.hint],
          hintsTotal: res.hintsTotal,
        }));
        say(`Hint: ${res.hint}`, 'info');
      } catch (e) {
        say(e instanceof Error ? e.message : String(e), 'warn');
      }
    },

    submit: async (diagnosisId) => {
      const s = get();
      const { sim, furnace, sessionId, panels, fdoors, repairs, violations, measurements } = s;
      if (!sessionId || (!sim && !furnace)) return;
      const body: SubmitRequest = {
        diagnosisId,
        equipmentJournal: s.equipmentJournal,
        repairs,
        safetyViolations: violations,
        measurementsTaken: measurements,
        elapsedSeconds: activeTime(s),
        ...(sim
          ? {
              finalState: {
                callingForCooling: sim.controls.calling,
                operatingMode: sim.controls.mode === 'heat' ? 'heat' : 'cool',
                defrostActive: sim.heatPump !== null && sim.heatPump.stage !== 'idle',
                heatDelivered: sim.heatPump !== null && sim.controls.mode === 'heat' && sim.compressor === 'running' && sim.heatPump.stage === 'idle' && sim.thermo.headSatF > sim.env.indoorF + 10,
                compressorRunning: sim.compressor === 'running',
                fanRunning: sim.fan === 'running',
                suctionPsig: suctionPsig(sim),
                liquidPsig: liquidPsig(sim),
                superheatF: superheatF(sim),
                subcoolF: subcoolF(sim),
                panelsInstalled: panels.access && panels.louver && panels.top,
              },
              service: {
                openedSystem: sim.service.opened,
                openedAtPsig: sim.service.openedAtPsig,
                testGas: sim.service.pressureTestGas,
                pressureTestPsig: sim.service.pressureTestPsig,
                deepestMicrons: sim.service.deepestMicrons,
                heldMicrons: sim.service.heldMicrons,
                finalChargeLb: sim.unit.chargeFraction * (sim.context?.factoryChargeLb ?? FACTORY_CHARGE_LB),
                factoryChargeLb: sim.context?.factoryChargeLb ?? FACTORY_CHARGE_LB,
              },
            }
          : {}),
        ...(furnace
          ? {
              furnaceFinal: {
                callingForHeat: furnace.controls.calling,
                burnersLit: furnace.flame,
                blowerRunning: furnace.blower === 'running',
                tempRiseF: tempRiseF(furnace),
                manifoldWc: manifoldWc(furnace),
                panelsInstalled: fdoors.burner && fdoors.blower,
              },
            }
          : {}),
      };
      set({ busy: true, error: null });
      try {
        const result = await api.submit(sessionId, body);
        set({ busy: false, result, phase: 'graded' });
      } catch (e) {
        set({ busy: false, error: e instanceof Error ? e.message : String(e) });
      }
    },
  };
});
