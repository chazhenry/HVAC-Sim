import { resolve } from '../engine';
import { isHot } from '../instruments';
import { componentById } from './registry';
import type { EquipmentAction, EquipmentActionResult, EquipmentMessage, OutdoorActionState } from './types';

/** Pure equipment commands; the store owns orchestration and presentation only. */
export function applyEquipmentAction(state: OutdoorActionState, action: EquipmentAction): EquipmentActionResult {
  const { sim } = state;
  const result: EquipmentActionResult = { sim, messages: [], violations: [], repairs: [], events: [] };
  const say = (text: string, kind: EquipmentMessage['kind'] = 'info'): void => { result.messages.push({ text, kind }); };
  const event = (type: EquipmentActionResult['events'][number]['type'], componentId: string, safe = true): void => {
    result.events.push({ type, componentId, t: sim.t, safe });
  };
  if (action.type === 'disconnect.toggle') {
    const disconnectIn = !sim.controls.disconnectIn;
    result.sim = resolve({ ...sim, controls: { ...sim.controls, disconnectIn } });
    event(disconnectIn ? 'power.restored' : 'power.isolated', 'system.outdoor.fuses');
    say(disconnectIn ? 'Disconnect inserted - the unit has power.' : 'Disconnect pulled - verify the unit is dead before touching anything.', disconnectIn ? 'warn' : 'good');
    return result;
  }
  const component = componentById(action.componentId);
  if (component.unitType !== 'condenser') throw new Error('Outdoor commands require an outdoor component');
  if ((component.kind === 'dualRunCapacitor' || component.kind === 'contactor') && state.panels.access) {
    say('Remove the electrical access panel with the nut driver first.');
    return result;
  }
  const powered = sim.controls.disconnectIn;
  const replace = (next: typeof sim.unit, repair: EquipmentActionResult['repairs'][number], text: string, unsafe: string): void => {
    if (powered) result.violations.push(unsafe);
    result.sim = resolve({ ...sim, unit: next });
    result.repairs.push(repair);
    event('component.replaced', component.id, !powered);
    say(text, 'good');
  };
  switch (component.kind) {
    case 'dualRunCapacitor':
      if (action.tool === 'discharge') {
        if (isHot(sim, 'CAP_C') || isHot(sim, 'CAP_HERM')) {
          result.violations.push('Tried to discharge the capacitor with the circuit energised');
          return result;
        }
        result.sim = { ...sim, capCharged: false };
        event('capacitor.discharged', component.id);
        say('Capacitor discharged across its terminals.', 'good');
      } else if (action.tool === 'part_capacitor') {
        const safe = !powered && !sim.capCharged;
        if (powered) result.violations.push('Replaced the capacitor with the disconnect in');
        else if (sim.capCharged) result.violations.push('Handled the capacitor without discharging it first');
        result.sim = resolve({ ...sim, capCharged: false, unit: { ...sim.unit, capacitor: {
          ...sim.unit.capacitor, hermUf: sim.unit.capacitor.ratedHermUf * 1.008, fanUf: sim.unit.capacitor.ratedFanUf * .996,
        } } });
        result.repairs.push('replace_capacitor');
        event('component.replaced', component.id, safe);
        say(`Fitted a new ${sim.unit.capacitor.ratedHermUf}/${sim.unit.capacitor.ratedFanUf} uF dual run capacitor.`, 'good');
      } else say('Dual run capacitor. Use the discharge tool, the meter, or a new capacitor from the parts bin.');
      break;
    case 'contactor':
      if (action.tool !== 'part_contactor') { say('Contactor. Probe its terminals with the meter, or fit a new one from the parts bin.'); break; }
      replace({ ...sim.unit, contactor: { coilOhms: 12.4, pole1Ohms: .01, pole2Ohms: .01 } }, 'replace_contactor',
        `Fitted a new ${sim.context?.contactorPoles ?? 2}-pole 30 A contactor.`, 'Replaced the contactor with the disconnect in');
      break;
    case 'fanMotor':
      if (action.tool !== 'part_fanmotor') { say('Condenser fan motor. Its leads are tested in the control box.'); break; }
      if (state.panels.top) { say('Swing the fan top up with the nut driver before changing the motor.'); break; }
      replace({ ...sim.unit, fanMotor: { ...sim.unit.fanMotor, runOhms: 38.5, auxOhms: 61.2, seized: false } }, 'replace_fan_motor',
        'Fitted a new condenser fan motor.', 'Replaced the fan motor with the disconnect in');
      break;
    case 'fuses':
      if (action.tool !== 'part_fuses') break;
      if (!state.doorOpen || powered) { say('Open the disconnect and pull it out to get at the fuses.'); break; }
      replace({ ...sim.unit, fuseL1Ok: true, fuseL2Ok: true }, 'replace_fuses', 'Fitted two new 30 A fuses.', '');
      break;
    case 'coil':
      if (action.tool !== 'hose') { say('Condenser coil. Use the coil cleaner and hose to wash it.'); break; }
      if (state.panels.louver) { say('Remove the front louver panel with the nut driver to get at the coil.'); break; }
      replace({ ...sim.unit, coilFouling: 0 }, 'clean_coil', 'Coil cleaned and rinsed from the inside out.', 'Washed the coil with the disconnect in');
      // Cleaning is a service action, not a component replacement.
      result.events = [];
      break;
    default: say('This component has no replacement action for the selected tool.');
  }
  return result;
}
