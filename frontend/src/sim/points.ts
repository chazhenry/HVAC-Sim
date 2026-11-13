/** One registry over the test and clamp points of every unit type. */
import { F_CLAMP_POINTS, F_TEST_POINTS, type FClampPointId, type FEnclosure, type FTestPointId } from './furnace/testPoints';
import { CLAMP_POINTS, type ClampPointId, type Enclosure, TEST_POINTS, type TestPointId } from './testPoints';
import { componentForTerminal } from './equipment/registry';

export type AnyTestPointId = TestPointId | FTestPointId;
export type AnyClampId = ClampPointId | FClampPointId;
export type AnyEnclosure = Enclosure | FEnclosure;

export const isFurnacePoint = (id: AnyTestPointId): id is FTestPointId => id in F_TEST_POINTS;
export const isFurnaceClamp = (id: AnyClampId): id is FClampPointId => id in F_CLAMP_POINTS;

export interface PointInfo {
  label: string;
  short: string;
  enclosure: AnyEnclosure;
  /** Terminal of a run capacitor: must be discharged before ohm / uF tests. */
  onCapacitor: boolean;
  componentId?: string;
}

export function pointInfo(id: AnyTestPointId): PointInfo {
  if (isFurnacePoint(id)) {
    const p = F_TEST_POINTS[id];
    const component = componentForTerminal(id);
    return { label: p.label, short: p.short, enclosure: p.enclosure, onCapacitor: 'part' in p && p.part === 'blowerCap',
      ...(component ? { componentId: component.id } : {}) };
  }
  const p = TEST_POINTS[id];
  const component = componentForTerminal(id);
  return {
    label: p.label,
    short: p.short,
    enclosure: p.enclosure,
    onCapacitor: 'part' in p && p.part.component === 'capacitor',
    ...(component ? { componentId: component.id } : {}),
  };
}

export const clampLabel = (id: AnyClampId): string =>
  isFurnaceClamp(id) ? F_CLAMP_POINTS[id].label : CLAMP_POINTS[id].label;
