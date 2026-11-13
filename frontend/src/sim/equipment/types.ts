import type { RepairAction } from '../../api/types';
import type { SimState } from '../engine';
import type { FurnaceState } from '../furnace/engine';

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

export type OutdoorTool = ToolId;
export type OutdoorTarget = 'capacitor' | 'contactor' | 'fanMotor' | 'fuses' | 'coil';
export type PanelId = 'access' | 'louver' | 'top';

export interface EquipmentEvent {
  readonly type: 'power.isolated' | 'power.restored' | 'measurement.voltage' | 'measurement.capacitance'
    | 'measurement.resistance' | 'measurement.current' | 'measurement.pressure' | 'measurement.temperatureRise'
    | 'capacitor.discharged' | 'component.replaced' | 'component.cleaned' | 'component.inspected'
    | 'gas.closed' | 'gas.opened' | 'door.opened' | 'door.closed' | 'interlock.bypassed' | 'interlock.released';
  readonly componentId: string;
  readonly t: number;
  readonly value?: number;
  readonly unit?: 'V' | 'µF' | 'Ω' | 'µA' | 'A' | 'inH2O' | '°F';
  readonly status?: 'open';
  readonly channel?: 'draft' | 'inlet' | 'manifold' | 'rise';
  readonly terminals?: readonly string[];
  readonly safe: boolean;
}
export interface EquipmentJournal { schemaVersion: 1; events: EquipmentEvent[] }
export interface EquipmentMessage { text: string; kind: 'info' | 'warn' | 'danger' | 'good' }
export interface OutdoorActionState {
  sim: SimState;
  panels: Record<PanelId, boolean>;
  doorOpen: boolean;
}
export type EquipmentAction = { type: 'component.use'; componentId: string; tool: OutdoorTool }
  | { type: 'disconnect.toggle' };
export interface EquipmentActionResult {
  sim: SimState;
  messages: EquipmentMessage[];
  violations: string[];
  repairs: RepairAction[];
  events: EquipmentEvent[];
}

export type FurnaceDoor = 'burner' | 'blower';
export type ManometerTap = 'draft' | 'inlet' | 'manifold';
export type FurnaceTarget = 'burnerDoor' | 'blowerDoor' | 'serviceSwitch' | 'doorSwitch' | 'gasCock'
  | 'igniter' | 'flameSensor' | 'pressureSwitch' | 'inducer' | 'gasValve' | 'blowerCap' | 'blowerMotor'
  | 'filter' | 'fuse' | 'board' | 'limit' | 'pressureTap' | 'inletTap' | 'manifoldTap' | 'supplyDuct' | 'returnDuct';
export interface FurnaceActionState {
  furnace: FurnaceState;
  fdoors: Record<FurnaceDoor, boolean>;
  doorSwitchTaped: boolean;
  manoAt: ManometerTap | null;
  probes: { supply: boolean; return: boolean };
}
export interface FurnaceAction { type: 'furnace.use'; target: FurnaceTarget; tool: ToolId }
export interface FurnaceActionResult extends FurnaceActionState {
  messages: EquipmentMessage[];
  violations: string[];
  repairs: RepairAction[];
  events: EquipmentEvent[];
  dropLeads: FurnaceDoor[];
  measurements: number;
}
