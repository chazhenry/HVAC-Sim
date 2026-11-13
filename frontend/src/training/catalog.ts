import data from '../../../backend/app/equipment/registry/training.json';
import type { EquipmentContext, ScenarioSummary } from '../api/types';

export type TrainingTrack = 'residential' | 'epa' | 'nate';
export const training = data;
export type TrainingSkill = typeof data.skills[number];
export const skillsForScenario = (id: string): TrainingSkill[] => training.skills.filter((skill) => skill.scenarioIds.includes(id));
export function compatibleScenarios(scenarios: ScenarioSummary[], context: EquipmentContext | null): ScenarioSummary[] {
  return scenarios.filter((scenario) => (!context || scenario.unitType === context.unitType)
    && (!scenario.id.startsWith('hp-') || context?.systemType === 'heat_pump'));
}
export function mappedScenarios(track: TrainingTrack, domain: string, skillId: string | null): Set<string> | null {
  if (track === 'residential') return null;
  if (track === 'epa') return new Set(training.epaPracticalScenarioIds);
  return new Set(training.skills.filter((skill) => skill.domain === domain && (!skillId || skill.id === skillId)).flatMap((skill) => skill.scenarioIds));
}
