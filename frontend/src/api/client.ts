import type {
  CatalogResponse,
  ExamPaper,
  ExamResult,
  ExamSection,
  ExamSectionInfo,
  GradeResponse,
  HintResponse,
  SessionResponse,
  SubmitRequest,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Where the API lives. Same-origin `/api` in development (Vite proxies it); a
 * production build can point at another host with VITE_API_BASE.
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError('Cannot reach the HVAC-Sim API. Is the backend running?', 0);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // Non-JSON error body (e.g. the dev proxy failing): keep the status text.
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const api = {
  catalog: () => request<CatalogResponse>('/catalog'),
  startSession: (scenarioId: string) => request<SessionResponse>('/sessions', post({ scenarioId })),
  hint: (sessionId: string) => request<HintResponse>(`/sessions/${sessionId}/hint`, post()),
  examSections: () => request<ExamSectionInfo[]>('/exam'),
  examPaper: (section: ExamSection) => request<ExamPaper>(`/exam/${section}`),
  gradeExam: (section: ExamSection, answers: Record<string, number>) =>
    request<ExamResult>(`/exam/${section}/grade`, post({ answers })),
  submit: (sessionId: string, body: SubmitRequest) =>
    request<GradeResponse>(`/sessions/${sessionId}/submit`, post(body)),
};
