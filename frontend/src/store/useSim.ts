import { create } from 'zustand';
import { api } from '../api/client';
import type {
  CatalogResponse,
  FurnaceParams,
  GradeResponse,
  RepairAction,
  ScenarioSummary,
  SubmitRequest,
  UnitParams,
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

export type ToolId =
  | 'hand'
  | 'nutdriver'
  | 'multimeter'
  | 'clamp'
  | 'ncv'
  | 'gauges'
  | 'tempclamp'
  | 'discharge'
  | 'hose'
  | 'part_capacitor'
  | 'part_contactor'
  | 'part_fanmotor'
  | 'part_fuses'
  // furnace
  | 'manometer'
  | 'thermo'
  | 'emery'
  | 'part_igniter'
  | 'part_flamesensor'
  | 'part_pswitch'
  | 'part_inducer'
  | 'part_gasvalve'
  | 'part_blowercap'
  | 'part_filter'
  | 'part_fuse3a'
  | 'part_limit'
  | 'part_board';

export type PanelId = 'access' | 'louver' | 'top';
export type PartTarget = 'capacitor' | 'contactor' | 'fanMotor' | 'fuses' | 'coil';
export type FurnaceDoor = 'burner' | 'blower';
export type ManometerTap = 'draft' | 'inlet' | 'manifold';
export type FurnaceTarget =
  | 'burnerDoor'
  | 'blowerDoor'
  | 'serviceSwitch'
  | 'doorSwitch'
  | 'gasCock'
  | 'igniter'
  | 'flameSensor'
  | 'pressureSwitch'
  | 'inducer'
  | 'gasValve'
  | 'blowerCap'
  | 'blowerMotor'
  | 'filter'
  | 'fuse'
  | 'board'
  | 'limit'
  | 'pressureTap'
  | 'inletTap'
  | 'manifoldTap'
  | 'supplyDuct'
  | 'returnDuct';
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

  loadCatalog: () => Promise<void>;
  startScenario: (id: string) => Promise<void>;
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

  /** Apply a change to the condenser's physical parameters and re-solve the circuit. */
  const patchUnit = (patch: (unit: UnitParams) => UnitParams, extra: Partial<SimState> = {}): void => {
    const { sim } = get();
    if (sim) set({ sim: resolve({ ...sim, ...extra, unit: patch(sim.unit) }) });
  };

  const patchFurnace = (patch: Partial<FurnaceParams>, extra: Partial<FurnaceState> = {}): void => {
    const { furnace } = get();
    if (furnace) set({ furnace: resolveFurnace({ ...furnace, ...extra, unit: { ...furnace.unit, ...patch } }) });
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

  /** Swap a furnace part. Returns false if the wrong tool is in hand. */
  const swapFurnacePart = (
    tool: ToolId,
    name: string,
    repair: RepairAction,
    patch: Partial<FurnaceParams>,
    idle: string,
  ): boolean => {
    const { furnace } = get();
    if (!furnace) return false;
    if (get().tool !== tool) {
      say(idle);
      return false;
    }
    if (furnace.controls.powerOn) violation(`Replaced the ${name} with the power on`);
    patchFurnace(patch);
    addRepair(repair);
    say(`Fitted a new ${name}.`, 'good');
    return true;
  };

  return {
    phase: 'loading',
    error: null,
    busy: false,
    catalog: null,
    sessionId: null,
    scenario: null,
    unitType: 'condenser',
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

    startScenario: async (id) => {
      set({ busy: true, error: null });
      try {
        const session = await api.startSession(id);
        const common = {
          ...fresh,
          busy: false,
          phase: 'running' as const,
          sessionId: session.sessionId,
          scenario: session.scenario,
          unitType: session.unitType,
          tstat: { mode: 'off' as TstatMode, setpointF: Math.round(session.environment.setpointF) },
        };
        if (session.unitType === 'furnace') {
          set({ ...common, sim: null, furnace: createFurnace(session.furnace, session.environment) });
          say('You arrive on site. The furnace has power and the thermostat is off.');
        } else {
          set({ ...common, furnace: null, sim: createSim(session.unit, session.environment) });
          say('You arrive on site. The disconnect is in and the thermostat is off.');
        }
      } catch (e) {
        set({ busy: false, error: e instanceof Error ? e.message : String(e) });
      }
    },

    backToMenu: () =>
      set({ ...fresh, phase: 'menu', sim: null, furnace: null, sessionId: null, scenario: null }),

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
      }
    },

    setTool: (tool) => set({ tool, hover: null }),
    setHover: (hover) => set({ hover }),

    setMeterMode: (meterMode) => {
      set({ meterMode });
      checkMeterSafety();
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
      if (changed && sim) set({ sim: resolve({ ...sim, controls: { ...sim.controls, calling } }) });
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
      const { sim } = get();
      if (!sim) return;
      const disconnectIn = !sim.controls.disconnectIn;
      set({ sim: resolve({ ...sim, controls: { ...sim.controls, disconnectIn } }) });
      say(
        disconnectIn
          ? 'Disconnect inserted - the unit has power.'
          : 'Disconnect pulled - verify the unit is dead before touching anything.',
        disconnectIn ? 'warn' : 'good',
      );
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
      if (!same) say(`Clamp meter around: ${clampLabel(id)}.`);
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
      const { tool, sim, panels, doorOpen } = get();
      if (!sim) return;
      const powered = sim.controls.disconnectIn;

      switch (target) {
        case 'capacitor': {
          if (tool === 'discharge') {
            if (isHot(sim, 'CAP_C') || isHot(sim, 'CAP_HERM')) {
              violation('Tried to discharge the capacitor with the circuit energised');
              return;
            }
            set({ sim: { ...sim, capCharged: false } });
            say('Capacitor discharged across its terminals.', 'good');
          } else if (tool === 'part_capacitor') {
            if (powered) violation('Replaced the capacitor with the disconnect in');
            else if (sim.capCharged) violation('Handled the capacitor without discharging it first');
            patchUnit(
              (u) => ({
                ...u,
                capacitor: {
                  ...u.capacitor,
                  hermUf: u.capacitor.ratedHermUf * 1.008,
                  fanUf: u.capacitor.ratedFanUf * 0.996,
                },
              }),
              { capCharged: false },
            );
            addRepair('replace_capacitor');
            say('Fitted a new 45/5 uF dual run capacitor.', 'good');
          } else {
            say('Dual run capacitor. Use the discharge tool, the meter, or a new capacitor from the parts bin.');
          }
          return;
        }
        case 'contactor': {
          if (tool !== 'part_contactor') {
            say('Contactor. Probe its terminals with the meter, or fit a new one from the parts bin.');
            return;
          }
          if (powered) violation('Replaced the contactor with the disconnect in');
          patchUnit((u) => ({ ...u, contactor: { coilOhms: 12.4, pole1Ohms: 0.01, pole2Ohms: 0.01 } }));
          addRepair('replace_contactor');
          say('Fitted a new 2-pole 30 A contactor.', 'good');
          return;
        }
        case 'fanMotor': {
          if (tool !== 'part_fanmotor') {
            say('Condenser fan motor. Its leads are tested in the control box.');
            return;
          }
          if (panels.top) {
            say('Swing the fan top up with the nut driver before changing the motor.');
            return;
          }
          if (powered) violation('Replaced the fan motor with the disconnect in');
          patchUnit((u) => ({
            ...u,
            fanMotor: { ...u.fanMotor, runOhms: 38.5, auxOhms: 61.2, seized: false },
          }));
          addRepair('replace_fan_motor');
          say('Fitted a new condenser fan motor.', 'good');
          return;
        }
        case 'fuses': {
          if (tool !== 'part_fuses') return;
          if (!doorOpen || powered) {
            say('Open the disconnect and pull it out to get at the fuses.');
            return;
          }
          patchUnit((u) => ({ ...u, fuseL1Ok: true, fuseL2Ok: true }));
          addRepair('replace_fuses');
          say('Fitted two new 30 A fuses.', 'good');
          return;
        }
        case 'coil': {
          if (tool !== 'hose') {
            say('Condenser coil. Use the coil cleaner and hose to wash it.');
            return;
          }
          if (panels.louver) {
            say('Remove the front louver panel with the nut driver to get at the coil.');
            return;
          }
          if (powered) violation('Washed the coil with the disconnect in');
          patchUnit((u) => ({ ...u, coilFouling: 0 }));
          addRepair('clean_coil');
          say('Coil cleaned and rinsed from the inside out.', 'good');
          return;
        }
      }
    },

    clickFurnace: (target) => {
      const { tool, furnace, fdoors } = get();
      if (!furnace) return;
      const powered = furnace.controls.powerOn;
      const setControls = (controls: Partial<FurnaceState['controls']>): void => {
        const f = get().furnace;
        if (f) set({ furnace: resolveFurnace({ ...f, controls: { ...f.controls, ...controls } }) });
      };

      switch (target) {
        case 'burnerDoor':
        case 'blowerDoor': {
          const door: FurnaceDoor = target === 'burnerDoor' ? 'burner' : 'blower';
          if (!needTool('hand', 'Furnace doors lift off by hand - select the hand.')) return;
          const fitted = !fdoors[door];
          set((s) => ({ fdoors: { ...s.fdoors, [door]: fitted } }));
          if (fitted) dropLeadsIn(door);
          if (door === 'blower') {
            if (fitted) set({ doorSwitchTaped: false });
            setControls({ doorClosed: fitted });
            say(
              fitted
                ? 'Refitted the blower door. The door switch is pressed in again.'
                : 'Lifted off the blower door. The door switch pops out and cuts power to the furnace.',
              fitted ? 'info' : 'warn',
            );
          } else say(fitted ? 'Refitted the burner door.' : 'Lifted off the burner door.');
          return;
        }
        case 'serviceSwitch': {
          if (!needTool('hand', 'Select the hand to flip the service switch.')) return;
          setControls({ powerOn: !powered });
          say(
            powered ? 'Service switch OFF - verify the furnace is dead before touching anything.' : 'Service switch ON.',
            powered ? 'good' : 'warn',
          );
          return;
        }
        case 'doorSwitch': {
          if (!needTool('hand', 'Select the hand to hold the door switch in.')) return;
          const taped = !get().doorSwitchTaped;
          set({ doorSwitchTaped: taped });
          setControls({ doorClosed: taped });
          say(
            taped
              ? 'Taped the door switch down so the furnace can run with the door off. Live parts are exposed.'
              : 'Removed the tape from the door switch.',
            taped ? 'warn' : 'info',
          );
          return;
        }
        case 'gasCock': {
          if (!needTool('hand', 'Gas shut-off valve. Select the hand to turn it.')) return;
          const open = !furnace.unit.gasCockOpen;
          patchFurnace({ gasCockOpen: open });
          if (open) addRepair('open_gas_cock');
          say(open ? 'Gas cock opened - handle in line with the pipe.' : 'Gas cock closed - handle across the pipe.');
          return;
        }
        case 'igniter':
          swapFurnacePart('part_igniter', 'hot-surface igniter', 'replace_igniter', { igniterOhms: 52 },
            'Hot-surface igniter. Never touch the element. Test it at its plug.');
          return;
        case 'flameSensor': {
          if (tool === 'emery') {
            if (powered) violation('Pulled the flame sensor with the power on');
            patchFurnace({ flameSensorDirt: 0.03 });
            addRepair('clean_flame_sensor');
            say('Pulled the flame sensor and polished the rod back to bright metal.', 'good');
          } else {
            swapFurnacePart('part_flamesensor', 'flame sensor', 'replace_flame_sensor', { flameSensorDirt: 0.02 },
              'Flame sensor rod. Read its signal in microamps, clean it with the abrasive pad.');
          }
          return;
        }
        case 'pressureSwitch':
          swapFurnacePart('part_pswitch', 'pressure switch', 'replace_pressure_switch', { pressureSwitchOk: true },
            'Pressure switch. Proves the inducer is moving flue gas before ignition is allowed.');
          return;
        case 'inducer':
          swapFurnacePart('part_inducer', 'inducer assembly', 'replace_inducer', { inducerOhms: 28.4 },
            'Inducer (draft) motor. Test for 120 V at its leads.');
          return;
        case 'gasValve': {
          const gasOn = furnace.unit.gasCockOpen;
          if (swapFurnacePart('part_gasvalve', 'gas valve', 'replace_gas_valve', { gasValveCoilOhms: 47.5 },
            'Gas valve. 24 V across MV and C opens it. Pressure taps are on its face.') && gasOn) {
            violation('Replaced the gas valve with the gas supply on');
          }
          return;
        }
        case 'blowerCap': {
          if (tool === 'discharge') {
            if (fIsHot(furnace, 'F_BCAP_A')) {
              violation('Tried to discharge the capacitor with the circuit energised');
              return;
            }
            set({ furnace: { ...furnace, capCharged: false } });
            say('Blower capacitor discharged across its terminals.', 'good');
            return;
          }
          const charged = furnace.capCharged;
          if (swapFurnacePart('part_blowercap', 'blower capacitor', 'replace_blower_capacitor',
            { blowerCapUf: furnace.unit.ratedBlowerCapUf * 1.01 }, 'Blower run capacitor - 7.5 uF 370 V.')) {
            if (charged && !powered) violation('Handled the capacitor without discharging it first');
            const f = get().furnace;
            if (f) set({ furnace: { ...f, capCharged: false } });
          }
          return;
        }
        case 'blowerMotor':
          say('Blower motor and wheel. Its leads and run capacitor are tested in this compartment.');
          return;
        case 'filter': {
          if (tool !== 'part_filter') {
            say(furnace.unit.filterDirt > 0.5 ? 'Air filter - grey and matted with dust.' : 'Air filter - looks clean.');
            return;
          }
          patchFurnace({ filterDirt: 0.05 });
          addRepair('replace_filter');
          say('Slid in a new filter, arrow pointing toward the furnace.', 'good');
          return;
        }
        case 'fuse':
          swapFurnacePart('part_fuse3a', '3 A fuse', 'replace_lv_fuse', { fuseOk: true },
            '3 A automotive-style fuse protecting the 24 V circuit.');
          return;
        case 'limit':
          swapFurnacePart('part_limit', 'high-limit switch', 'replace_limit_switch', { limitOk: true },
            'High-limit switch. Opens if the heat exchanger overheats.');
          return;
        case 'board':
          swapFurnacePart('part_board', 'control board', 'replace_control_board', {},
            'Integrated furnace control. The LED shows status and fault codes.');
          return;
        case 'pressureTap':
        case 'inletTap':
        case 'manifoldTap': {
          if (!needTool('manometer', 'Select the manometer to read pressure here.')) return;
          const tap: ManometerTap = target === 'pressureTap' ? 'draft' : target === 'inletTap' ? 'inlet' : 'manifold';
          const same = get().manoAt === tap;
          set((s) => ({ manoAt: same ? null : tap, measurements: s.measurements + (same ? 0 : 1) }));
          if (!same) say(`Manometer connected: ${tap === 'draft' ? 'pressure switch tap' : `gas valve ${tap} tap`}.`);
          return;
        }
        case 'supplyDuct':
        case 'returnDuct': {
          if (!needTool('thermo', 'Select the temperature probes to measure air temperature here.')) return;
          const side = target === 'supplyDuct' ? 'supply' : 'return';
          const on = !get().probes[side];
          set((s) => ({ probes: { ...s.probes, [side]: on }, measurements: s.measurements + (on ? 1 : 0) }));
          say(`Temperature probe ${on ? 'in' : 'out of'} the ${side} air.`);
          return;
        }
      }
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
        repairs,
        safetyViolations: violations,
        measurementsTaken: measurements,
        elapsedSeconds: activeTime(s),
        ...(sim
          ? {
              finalState: {
                callingForCooling: sim.controls.calling,
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
                finalChargeLb: sim.unit.chargeFraction * FACTORY_CHARGE_LB,
                factoryChargeLb: FACTORY_CHARGE_LB,
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
