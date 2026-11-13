import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GradeResponse, UnitParams, ScenarioSummary, EquipmentContext } from '../api/types';
import { api } from '../api/client';
import { createSim } from '../sim/engine';
import { rememberGuestName } from '../store/guest';
import { useSim } from '../store/useSim';
import { completedPractice, EMPTY_PROGRESS, progressForUser, useTrainingProgress } from '../store/useTrainingProgress';
import { ScenarioCards, TrainingMenu } from '../ui/TrainingMenu';
import { compatibleScenarios, mappedScenarios, skillsForScenario } from './catalog';

const grade = (): GradeResponse => ({ score: 100, diagnosisCorrect: true,
  correctDiagnosis: { id: 'cap_herm', label: 'Capacitor', unitType: 'condenser' }, explanation: 'Repaired.',
  breakdown: [
    { label: 'Diagnostic procedure', points: 20, maxPoints: 20, note: '' },
    { label: 'Verified operation', points: 15, maxPoints: 15, note: '' },
    { label: 'Safety', points: 15, maxPoints: 15, note: '' },
  ],
});
const scenario: ScenarioSummary = { id: 'hum-no-start', title: 'Warm air', complaint: 'Compressor hums.', difficulty: 'easy', unitType: 'condenser' };
const unit: UnitParams = { fuseL1Ok: true, fuseL2Ok: true, chargeFraction: 1, coilFouling: 0,
  contactor: { coilOhms: 12, pole1Ohms: .01, pole2Ohms: .01 }, capacitor: { ratedHermUf: 45, ratedFanUf: 5, hermUf: 8.6, fanUf: 5 },
  compressor: { runOhms: .9, startOhms: 2.4, rla: 16, lra: 75 }, fanMotor: { runOhms: 38, auxOhms: 62, seized: false, fla: 1.4 } };
let saved: Map<string, string>;
beforeEach(() => {
  vi.restoreAllMocks();
  saved = new Map();
  vi.stubGlobal('window', { localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) } });
  rememberGuestName('Ada');
  useTrainingProgress.setState({ profiles: {} });
});

describe('practice progress', () => {
  it('requires diagnosis, repair evidence, operation and safety rather than score alone', () => {
    expect(completedPractice(grade())).toBe(true);
    for (const label of ['Diagnostic procedure', 'Verified operation', 'Safety']) {
      const result = grade(); result.breakdown.find((line) => line.label === label)!.points = 0;
      expect(completedPractice(result)).toBe(false);
    }
    expect(completedPractice({ ...grade(), diagnosisCorrect: false })).toBe(false);
    expect(completedPractice({ ...grade(), score: 79 })).toBe(false);
  });
  it('persists best results, deduplicates the same session and isolates named guests', () => {
    const store = useTrainingProgress.getState();
    store.recordJob('hum-no-start', 'one', grade(), 'Ada');
    store.recordJob('hum-no-start', 'one', grade(), 'Ada');
    store.recordJob('hum-no-start', 'two', { ...grade(), score: 30 }, 'Ada');
    store.recordJob('hum-no-start', 'three', { ...grade(), score: 50 }, 'Bob');
    expect(useTrainingProgress.getState().profiles.Ada!.jobs['hum-no-start']).toMatchObject({ attempts: 2, bestScore: 100, completed: true });
    expect(useTrainingProgress.getState().profiles.Bob!.jobs['hum-no-start']?.completed).toBe(false);
    useTrainingProgress.setState({ profiles: {} });
    store.hydrate('Ada');
    expect(useTrainingProgress.getState().profiles.Ada!.jobs['hum-no-start']?.completed).toBe(true);
    expect(progressForUser(useTrainingProgress.getState().profiles, 'Bob')).toBe(EMPTY_PROGRESS);
  });
  it('keeps successful exam practice after a later failed retake', () => {
    const store = useTrainingProgress.getState();
    store.recordExam('core', { percent: 90, passed: true, correct: 9, total: 10, results: [] });
    store.recordExam('core', { percent: 40, passed: false, correct: 4, total: 10, results: [] });
    expect(useTrainingProgress.getState().profiles.Ada!.exams.core).toEqual({ bestPercent: 90, attempts: 2, passed: true });
  });
  it('survives unavailable storage, malformed saved data and prototype-like guest names', () => {
    saved.set('hvac-sim.training.v1.Ada', '{broken');
    useTrainingProgress.getState().hydrate('Ada');
    expect(useTrainingProgress.getState().profiles.Ada).toBe(EMPTY_PROGRESS);
    expect(progressForUser({}, 'constructor')).toBe(EMPTY_PROGRESS);
    vi.stubGlobal('window', { get localStorage() { throw new Error('Blocked'); } });
    useTrainingProgress.getState().recordJob('hum-no-start', 'one', grade(), 'constructor');
    expect(progressForUser(useTrainingProgress.getState().profiles, 'constructor').jobs['hum-no-start']?.completed).toBe(true);
  });
  it('records only a successful server submission for the signed-in guest', async () => {
    useSim.setState({ ...useSim.getInitialState(), sessionId: 'new-job', scenario, sim: createSim(unit, { outdoorF: 95, indoorF: 78, setpointF: 72 }) });
    const submit = vi.spyOn(api, 'submit').mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(grade());
    await useSim.getState().submit('cap_herm');
    expect(useTrainingProgress.getState().profiles).toEqual({});
    await useSim.getState().submit('cap_herm');
    expect(submit).toHaveBeenCalledTimes(2);
    expect(useTrainingProgress.getState().profiles.Ada!.jobs['hum-no-start']?.completed).toBe(true);
  });
});

describe('training paths and cards', () => {
  it.each(['epa', 'nate'] as const)('renders the selected %s path when returning from a child screen', (track) => {
    const html = renderToStaticMarkup(<TrainingMenu catalog={{ scenarios: [scenario], contexts: [], diagnoses: [] }} context={null}
      onContext={() => {}} busy={false} onStart={() => {}} onExam={() => {}} track={track} onTrackChange={() => {}} />);
    expect(html).toContain(`id="track-${track}" aria-selected="true"`);
    expect(html).toContain(track === 'epa' ? 'Refrigerant service practice' : 'Mapped skill objectives');
  });
  it('keeps all residential calls and limits EPA practical work and NATE skill filters', () => {
    expect(mappedScenarios('residential', 'electrical', null)).toBeNull();
    expect([...mappedScenarios('epa', 'electrical', null)!]).toEqual(['c-608-drier']);
    const electrical = mappedScenarios('nate', 'electrical', 'control-sequences')!;
    expect(electrical.has('hp-defrost')).toBe(true); expect(electrical.has('f-filter')).toBe(false);
    expect(skillsForScenario('f-filter').some((skill) => skill.id === 'airflow-rise')).toBe(true);
  });
  it('preserves equipment compatibility inside training paths', () => {
    const scenarios = [scenario, { ...scenario, id: 'hp-defrost' }, { ...scenario, id: 'f-filter', unitType: 'furnace' as const }];
    const context = { unitType: 'condenser', systemType: 'air_conditioner' } as EquipmentContext;
    expect(compatibleScenarios(scenarios, context).map((item) => item.id)).toEqual(['hum-no-start']);
    expect(compatibleScenarios(scenarios, { ...context, systemType: 'heat_pump' })).toHaveLength(2);
  });
  it('shows measured practice progress without claiming certification', () => {
    const html = renderToStaticMarkup(<ScenarioCards scenarios={[scenario]} busy={false} showSkills progress={{ ...EMPTY_PROGRESS,
      jobs: { 'hum-no-start': { attempts: 1, completed: true, bestScore: 100, lastSessionId: 'one' } } }} onStart={() => {}} />);
    expect(html).toContain('Practice completed'); expect(html).toContain('Best 100/100');
    expect(html).toContain('Meters and component tests'); expect(html).not.toContain('certified');
  });
});
