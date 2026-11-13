import type { FurnaceParams, RepairAction } from '../../api/types';
import { resolveFurnace } from '../furnace/engine';
import { fIsHot } from '../furnace/instruments';
import { componentForTarget } from './registry';
import type { EquipmentEvent, EquipmentMessage, FurnaceAction, FurnaceActionResult, FurnaceActionState, ToolId } from './types';

/** Pure furnace commands. No UI store, network access or shared mutable state. */
export function applyFurnaceAction(state: FurnaceActionState, action: FurnaceAction): FurnaceActionResult {
  const result: FurnaceActionResult = { ...state, messages: [], violations: [], repairs: [], events: [], dropLeads: [], measurements: 0 };
  const { furnace } = state;
  const { target, tool } = action;
  const powered = furnace.controls.powerOn;
  const component = componentForTarget('furnace', target);
  const say = (text: string, kind: EquipmentMessage['kind'] = 'info'): void => { result.messages.push({ text, kind }); };
  const event = (type: EquipmentEvent['type'], componentId = component!.id, safe = true): void => {
    result.events.push({ type, componentId, safe, t: furnace.t });
  };
  const need = (wanted: ToolId, text: string): boolean => tool === wanted || (say(text), false);
  const controls = (patch: Partial<typeof furnace.controls>): void => {
    result.furnace = resolveFurnace({ ...result.furnace, controls: { ...result.furnace.controls, ...patch } });
  };
  const patch = (parameters: Partial<FurnaceParams>): void => {
    result.furnace = resolveFurnace({ ...result.furnace, unit: { ...result.furnace.unit, ...parameters } });
  };
  const swap = (wanted: ToolId, name: string, repair: RepairAction, parameters: Partial<FurnaceParams>, idle: string): boolean => {
    if (!need(wanted, idle)) return false;
    const charged = target === 'blowerCap' && furnace.capCharged;
    const gasOn = target === 'gasValve' && furnace.unit.gasCockOpen;
    if (powered) result.violations.push(`Replaced the ${name} with the power on`);
    if (charged && !powered) result.violations.push('Handled the capacitor without discharging it first');
    if (gasOn) result.violations.push('Replaced the gas valve with the gas supply on');
    patch(parameters);
    result.repairs.push(repair);
    event('component.replaced', component!.id, !powered && !charged && !gasOn);
    say(`Fitted a new ${name}.`, 'good');
    return true;
  };

  // Scene visibility is not an access-control boundary: enforce access for direct commands too.
  if (component && !['filter', 'gasCock', 'serviceSwitch', 'burnerDoor', 'blowerDoor'].includes(target)) {
    const door = component.assemblyId === 'system.indoor.burner' ? 'burner' : 'blower';
    if (state.fdoors[door]) { say(`Remove the ${door} door first.`); return result; }
  }
  switch (target) {
    case 'burnerDoor':
    case 'blowerDoor': {
      if (!need('hand', 'Furnace doors lift off by hand - select the hand.')) break;
      const door = target === 'burnerDoor' ? 'burner' : 'blower';
      const fitted = !state.fdoors[door];
      result.fdoors = { ...state.fdoors, [door]: fitted };
      if (fitted) result.dropLeads.push(door);
      if (door === 'blower') {
        result.doorSwitchTaped = false;
        controls({ doorClosed: fitted });
        if (state.doorSwitchTaped) event('interlock.released', 'system.indoor.doorSwitch');
      }
      event(fitted ? 'door.closed' : 'door.opened');
      say(fitted ? `Refitted the ${door} door.` : `Lifted off the ${door} door.${door === 'blower' ? ' The door switch cuts power to the furnace.' : ''}`, fitted ? 'info' : 'warn');
      break;
    }
    case 'serviceSwitch':
      if (!need('hand', 'Select the hand to flip the service switch.')) break;
      controls({ powerOn: !powered });
      event(powered ? 'power.isolated' : 'power.restored');
      say(powered ? 'Service switch OFF - verify the furnace is dead before touching anything.' : 'Service switch ON.', powered ? 'good' : 'warn');
      break;
    case 'doorSwitch': {
      if (!need('hand', 'Select the hand to hold the door switch in.')) break;
      const taped = !state.doorSwitchTaped;
      result.doorSwitchTaped = taped;
      controls({ doorClosed: taped });
      event(taped ? 'interlock.bypassed' : 'interlock.released');
      say(taped ? 'Taped the door switch down so the furnace can run with the door off. Live parts are exposed.' : 'Removed the tape from the door switch.', taped ? 'warn' : 'info');
      break;
    }
    case 'gasCock': {
      if (!need('hand', 'Gas shut-off valve. Select the hand to turn it.')) break;
      const open = !furnace.unit.gasCockOpen;
      patch({ gasCockOpen: open });
      if (open) result.repairs.push('open_gas_cock');
      event(open ? 'gas.opened' : 'gas.closed');
      say(open ? 'Gas cock opened - handle in line with the pipe.' : 'Gas cock closed - handle across the pipe.');
      break;
    }
    case 'igniter':
      swap('part_igniter', 'hot-surface igniter', 'replace_igniter', { igniterOhms: 52 }, 'Hot-surface igniter. Never touch the element. Test it at its plug.'); break;
    case 'flameSensor':
      if (tool === 'emery') {
        if (powered) result.violations.push('Pulled the flame sensor with the power on');
        patch({ flameSensorDirt: .03 });
        result.repairs.push('clean_flame_sensor');
        event('component.cleaned', component!.id, !powered);
        say('Pulled the flame sensor and polished the rod back to bright metal.', 'good');
      } else swap('part_flamesensor', 'flame sensor', 'replace_flame_sensor', { flameSensorDirt: .02 }, 'Flame sensor rod. Read its signal in microamps, clean it with the abrasive pad.');
      break;
    case 'pressureSwitch':
      swap('part_pswitch', 'pressure switch', 'replace_pressure_switch', { pressureSwitchOk: true }, 'Pressure switch. Proves the inducer is moving flue gas before ignition is allowed.'); break;
    case 'inducer':
      swap('part_inducer', 'inducer assembly', 'replace_inducer', { inducerOhms: 28.4 }, 'Inducer (draft) motor. Test for 120 V at its leads.'); break;
    case 'gasValve':
      swap('part_gasvalve', 'gas valve', 'replace_gas_valve', { gasValveCoilOhms: 47.5 }, 'Gas valve. 24 V across MV and C opens it. Pressure taps are on its face.'); break;
    case 'blowerCap':
      if (tool === 'discharge') {
        if (fIsHot(furnace, 'F_BCAP_A') || fIsHot(furnace, 'F_BCAP_B')) { result.violations.push('Tried to discharge the capacitor with the circuit energised'); break; }
        result.furnace = { ...furnace, capCharged: false };
        event('capacitor.discharged');
        say('Blower capacitor discharged across its terminals.', 'good');
      } else if (swap('part_blowercap', 'blower capacitor', 'replace_blower_capacitor', { blowerCapUf: furnace.unit.ratedBlowerCapUf * 1.01 }, `Blower run capacitor - ${furnace.unit.ratedBlowerCapUf} uF.`)) {
        result.furnace = { ...result.furnace, capCharged: false };
      }
      break;
    case 'blowerMotor': say('Blower motor and wheel. Its leads and run capacitor are tested in this compartment.'); break;
    case 'filter':
      if (tool !== 'part_filter') {
        event('component.inspected');
        say(furnace.unit.filterDirt > .5 ? 'Air filter - grey and matted with dust.' : 'Air filter - looks clean.');
      } else {
        if (powered) result.violations.push('Replaced the filter with the power on');
        patch({ filterDirt: .05 }); result.repairs.push('replace_filter');
        event('component.replaced', component!.id, !powered);
        say('Slid in a new filter, arrow pointing toward the furnace.', 'good');
      }
      break;
    case 'fuse': swap('part_fuse3a', '3 A fuse', 'replace_lv_fuse', { fuseOk: true }, '3 A automotive-style fuse protecting the 24 V circuit.'); break;
    case 'limit': swap('part_limit', 'high-limit switch', 'replace_limit_switch', { limitOk: true }, 'High-limit switch. Opens if the heat exchanger overheats.'); break;
    case 'board': swap('part_board', 'control board', 'replace_control_board', {}, 'Integrated furnace control. The LED shows status and fault codes.'); break;
    case 'pressureTap':
    case 'inletTap':
    case 'manifoldTap': {
      if (state.fdoors.burner) { say('Remove the burner door first.'); break; }
      if (!need('manometer', 'Select the manometer to read pressure here.')) break;
      const tap = target === 'pressureTap' ? 'draft' : target === 'inletTap' ? 'inlet' : 'manifold';
      result.manoAt = state.manoAt === tap ? null : tap;
      if (result.manoAt) { result.measurements++; say(`Manometer connected: ${tap === 'draft' ? 'pressure switch tap' : `gas valve ${tap} tap`}.`); }
      break;
    }
    case 'supplyDuct':
    case 'returnDuct': {
      if (!need('thermo', 'Select the temperature probes to measure air temperature here.')) break;
      const side = target === 'supplyDuct' ? 'supply' : 'return';
      const on = !state.probes[side];
      result.probes = { ...state.probes, [side]: on };
      if (on) result.measurements++;
      say(`Temperature probe ${on ? 'in' : 'out of'} the ${side} air.`);
      break;
    }
  }
  return result;
}
