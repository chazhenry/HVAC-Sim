import type { AnyClampId, AnyTestPointId } from '../points';
import { isFurnaceClamp, isFurnacePoint } from '../points';
import { draftWc, inletWc, manifoldWc, tempRiseF } from '../furnace/engine';
import { fProbeVolts, fReadClamp, fReadMeter } from '../furnace/instruments';
import { F_TEST_POINTS, type FTestPointId } from '../furnace/testPoints';
import type { MeterMode } from '../instruments';
import { components } from './registry';
import type { EquipmentEvent, FurnaceActionState } from './types';

/** Snapshot only connected instruments. A display reading, not hidden fault state, supplies evidence. */
export function furnaceMeasurements(
  state: FurnaceActionState,
  leads: { red: AnyTestPointId | null; black: AnyTestPointId | null },
  mode: MeterMode,
  clamp: AnyClampId | null,
): EquipmentEvent[] {
  const { furnace } = state;
  const events: EquipmentEvent[] = [];
  const emit = (event: Omit<EquipmentEvent, 't' | 'safe'>, safe = true): void => { events.push({ ...event, safe, t: furnace.t }); };
  const { red, black } = leads;
  if (red && black && red !== black && isFurnacePoint(red) && isFurnacePoint(black)) {
    const accessible = (id: FTestPointId): boolean => {
      const enclosure = F_TEST_POINTS[id].enclosure;
      return enclosure === 'switchBox' || !state.fdoors[enclosure];
    };
    const component = components.find((item) => item.unitType === 'furnace' && (
      [red, black].every((id) => item.terminals.includes(id)) || item.measurementPairs?.some((pair) => pair.includes(red) && pair.includes(black))));
    if (component && accessible(red) && accessible(black)) {
      const reading = fReadMeter(furnace, mode, red, black);
      const safe = mode === 'vac' || mode === 'ua' || (!furnace.controls.powerOn && fProbeVolts(furnace, red, black) <= 3
        && (component.kind !== 'capacitor' || !furnace.capCharged));
      const base = { componentId: component.id, terminals: [red, black].sort() };
      if (reading.kind === 'ol' && mode === 'ohm') emit({ ...base, type: 'measurement.resistance', unit: 'Ω', status: 'open' }, safe);
      if (reading.kind === 'value') {
        const types = { V: 'measurement.voltage', 'Ω': 'measurement.resistance', 'µF': 'measurement.capacitance', 'µA': 'measurement.current' } as const;
        // Zero current with unlit burners cannot diagnose a dirty flame sensor.
        if (mode !== 'ua' || furnace.flame) emit({ ...base, type: types[reading.unit], value: reading.value, unit: reading.unit }, safe);
      }
    }
  }
  if (state.manoAt && !state.fdoors.burner) {
    const channel = state.manoAt;
    // A zero manifold reading is diagnostic only during an ignition command.
    if (channel !== 'manifold' || furnace.board.relays.gas) emit({
      type: 'measurement.pressure', componentId: `system.indoor.${channel === 'draft' ? 'pressureSwitch' : 'gasValve'}`,
      channel, unit: 'inH2O', value: channel === 'draft' ? draftWc(furnace) : channel === 'inlet' ? inletWc(furnace) : manifoldWc(furnace),
    });
  }
  if (state.probes.supply && state.probes.return) emit({ type: 'measurement.temperatureRise', componentId: 'system.indoor.filter', channel: 'rise', unit: '°F', value: tempRiseF(furnace) });
  if (clamp && isFurnaceClamp(clamp) && !state.fdoors[clamp === 'F_W_BLW' || clamp === 'F_W_L1' ? 'blower' : 'burner']) {
    const id = { F_W_L1: 'serviceSwitch', F_W_IND: 'inducer', F_W_IGN: 'igniter', F_W_BLW: 'blower', F_W_GV: 'gasValve' }[clamp];
    emit({ type: 'measurement.current', componentId: `system.indoor.${id}`, unit: 'A', value: fReadClamp(furnace, clamp) });
  }
  return events;
}
