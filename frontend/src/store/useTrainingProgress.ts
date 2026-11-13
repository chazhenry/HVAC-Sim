import { create } from 'zustand';
import type { ExamResult, ExamSection, GradeResponse } from '../api/types';
import { rememberedGuestName } from './guest';

interface JobProgress { bestScore: number; attempts: number; completed: boolean; lastSessionId: string }
interface ExamProgress { bestPercent: number; attempts: number; passed: boolean }
export interface TrainingProgress {
  schemaVersion: 1;
  jobs: Record<string, JobProgress>;
  exams: Partial<Record<ExamSection, ExamProgress>>;
}
export const EMPTY_PROGRESS: TrainingProgress = { schemaVersion: 1, jobs: {}, exams: {} };
export const progressForUser = (profiles: Record<string, TrainingProgress>, user: string): TrainingProgress =>
  Object.hasOwn(profiles, user) ? profiles[user]! : EMPTY_PROGRESS;
const key = (user: string): string => `hvac-sim.training.v1.${encodeURIComponent(user)}`;
function load(user: string): TrainingProgress {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key(user)) ?? 'null');
    if (!value || typeof value !== 'object' || !('schemaVersion' in value) || value.schemaVersion !== 1) return EMPTY_PROGRESS;
    // Treat saved browser data as untrusted; keep valid entries if another is damaged.
    const candidate = value as TrainingProgress;
    const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
    const jobs = Object.fromEntries(Object.entries(candidate.jobs ?? {}).filter(([, item]) => item && valid(item.bestScore) && item.bestScore <= 100
      && valid(item.attempts) && typeof item.completed === 'boolean' && typeof item.lastSessionId === 'string'));
    const exams = Object.fromEntries(Object.entries(candidate.exams ?? {}).filter(([id, item]) => ['core', 'type1', 'type2', 'type3'].includes(id)
      && item && valid(item.bestPercent) && item.bestPercent <= 100 && valid(item.attempts) && typeof item.passed === 'boolean'));
    return { schemaVersion: 1, jobs, exams };
  } catch { return EMPTY_PROGRESS; }
}

export function completedPractice(result: GradeResponse): boolean {
  const full = (label: string): boolean => result.breakdown.some((line) => line.label === label && line.maxPoints > 0 && line.points === line.maxPoints);
  return result.score >= 80 && result.diagnosisCorrect && full('Verified operation') && full('Safety')
    && ['Repair', 'Diagnostic procedure', 'Service procedure'].some(full);
}

interface ProgressState {
  profiles: Record<string, TrainingProgress>;
  hydrate: (user: string) => void;
  recordJob: (scenarioId: string, sessionId: string, result: GradeResponse, user?: string) => void;
  recordExam: (section: ExamSection, result: ExamResult, user?: string) => void;
}
export const useTrainingProgress = create<ProgressState>((set, get) => {
  const read = (user: string): TrainingProgress => Object.hasOwn(get().profiles, user) ? progressForUser(get().profiles, user) : load(user);
  const save = (user: string, progress: TrainingProgress): void => {
    try { window.localStorage.setItem(key(user), JSON.stringify(progress)); } catch { /* Keep this visit's progress in memory. */ }
    set((state) => ({ profiles: { ...state.profiles, [user]: progress } }));
  };
  return {
    profiles: {},
    hydrate: (user) => { if (user && !Object.hasOwn(get().profiles, user)) set((state) => ({ profiles: { ...state.profiles, [user]: load(user) } })); },
    recordJob: (scenarioId, sessionId, result, user = rememberedGuestName()) => {
      if (!user || !Number.isFinite(result.score)) return;
      const progress = read(user); const previous = progress.jobs[scenarioId];
      if (previous?.lastSessionId === sessionId) return;
      save(user, { ...progress, jobs: { ...progress.jobs, [scenarioId]: {
        bestScore: Math.max(previous?.bestScore ?? 0, Math.min(100, Math.max(0, result.score))),
        attempts: (previous?.attempts ?? 0) + 1, completed: (previous?.completed ?? false) || completedPractice(result), lastSessionId: sessionId,
      } } });
    },
    recordExam: (section, result, user = rememberedGuestName()) => {
      if (!user || !Number.isFinite(result.percent)) return;
      const progress = read(user); const previous = progress.exams[section];
      save(user, { ...progress, exams: { ...progress.exams, [section]: {
        bestPercent: Math.max(previous?.bestPercent ?? 0, Math.min(100, Math.max(0, result.percent))),
        attempts: (previous?.attempts ?? 0) + 1, passed: (previous?.passed ?? false) || result.passed,
      } } });
    },
  };
});
