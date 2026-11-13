import data from '../../../../backend/app/equipment/registry/procedures.json';
import type { EquipmentEvent } from './types';

export interface ProcedureStep {
  readonly id: string;
  readonly label: string;
  readonly eventType: EquipmentEvent['type'] | 'operation.verified';
  readonly componentId: string;
  readonly requires: readonly string[];
  readonly invalidatedBy: readonly string[];
  readonly points: number;
  readonly unit?: EquipmentEvent['unit'];
  readonly status?: EquipmentEvent['status'];
  readonly channel?: EquipmentEvent['channel'];
  readonly eventTypes?: readonly EquipmentEvent['type'][];
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly terminals?: readonly string[];
}
export interface ProcedureDefinition { readonly id: string; readonly title: string; readonly verificationComponentId: string; readonly steps: readonly ProcedureStep[] }
export const procedures = data.procedures as readonly ProcedureDefinition[];
export const procedureById = (id: string): ProcedureDefinition | undefined => procedures.find((procedure) => procedure.id === id);

export function procedureProgress(procedure: ProcedureDefinition, journal: readonly EquipmentEvent[], operationVerified = false): ReadonlySet<string> {
  const completed = new Set<string>();
  const active = new Set<string>();
  const events: Array<Omit<EquipmentEvent, 'type'> & { type: ProcedureStep['eventType'] }> = [...journal];
  if (operationVerified) events.push({ type: 'operation.verified', componentId: procedure.verificationComponentId, safe: true, t: journal.at(-1)?.t ?? 0 });
  for (const event of events) {
    for (const step of procedure.steps) if (step.invalidatedBy.includes(event.type)) active.delete(step.id);
    if (!event.safe) continue;
    for (const step of procedure.steps) {
      if (step.eventType !== event.type && !step.eventTypes?.includes(event.type as EquipmentEvent['type'])) continue;
      if (step.componentId !== event.componentId || !step.requires.every((id) => active.has(id))) continue;
      if (step.unit && step.unit !== event.unit) continue;
      if (step.status && step.status !== event.status || step.channel && step.channel !== event.channel) continue;
      if (step.minValue !== undefined && (event.value === undefined || event.value < step.minValue)) continue;
      if (step.maxValue !== undefined && (event.value === undefined || event.value > step.maxValue)) continue;
      if (step.terminals && (event.terminals?.length !== step.terminals.length || !step.terminals.every((id) => event.terminals?.includes(id)))) continue;
      active.add(step.id); completed.add(step.id);
    }
  }
  return completed;
}
