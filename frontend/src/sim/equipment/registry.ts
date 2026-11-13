import registry from '../../../../backend/app/equipment/registry/components.json';

export interface ComponentDefinition {
  readonly id: string;
  readonly assemblyId: string;
  readonly unitType: 'condenser' | 'furnace';
  readonly kind: string;
  readonly target: string | null;
  readonly terminals: readonly string[];
  readonly measurementPairs?: readonly (readonly string[])[];
}

export const components: readonly ComponentDefinition[] = registry.components.map((component) => {
  if (component.unitType !== 'condenser' && component.unitType !== 'furnace') throw new Error('Unknown equipment family');
  return { ...component, unitType: component.unitType };
});
export const assemblies = registry.assemblies;
const byId = new Map(components.map((component) => [component.id, component]));
const byTerminal = new Map(components.flatMap((component) => component.terminals.map((terminal) => [terminal, component] as const)));

export function componentById(id: string): ComponentDefinition {
  const component = byId.get(id);
  if (!component) throw new Error(`Unknown equipment component: ${id}`);
  return component;
}
export const componentForTerminal = (terminal: string): ComponentDefinition | undefined => byTerminal.get(terminal);
export function componentForTarget(unitType: 'condenser' | 'furnace', target: string): ComponentDefinition | undefined {
  return components.find((component) => component.unitType === unitType && component.target === target);
}
