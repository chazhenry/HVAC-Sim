import type { ToolId } from '../store/useSim';

/**
 * Plain tool names for messages such as "nothing to do here with the clamp meter". Kept apart from
 * Toolbox.tsx so the 3D parts can use it without importing the toolbox UI (which imports the scene).
 * Keep in step with the tool bag (Toolbox.tsx GROUPS).
 */
export const TOOL_NAMES: Partial<Record<ToolId, string>> = {
  hand: 'Hand',
  speak: 'Speak tool',
  firstprinciples: 'First Principles videos',
  nutdriver: 'Nut driver',
  multimeter: 'Multimeter',
  clamp: 'Clamp meter',
  ncv: 'Voltage tester',
  discharge: 'Cap discharge tool',
  gauges: 'Manifold gauges',
  tempclamp: 'Temp clamps',
  hose: 'Coil cleaner',
  manometer: 'Manometer',
  thermo: 'Temp probes',
  emery: 'Abrasive pad',
  part_capacitor: 'Replacement capacitor',
  part_contactor: 'Replacement contactor',
  part_fanmotor: 'Replacement fan motor',
  part_fuses: 'Replacement fuses',
  part_igniter: 'Replacement igniter',
  part_flamesensor: 'Replacement flame sensor',
  part_pswitch: 'Replacement pressure switch',
  part_inducer: 'Replacement inducer',
  part_gasvalve: 'Replacement gas valve',
  part_blowercap: 'Replacement blower capacitor',
  part_filter: 'Replacement air filter',
  part_limit: 'Replacement limit switch',
  part_board: 'Replacement control board',
};

export const toolName = (tool: ToolId): string => TOOL_NAMES[tool] ?? 'tool in hand';
