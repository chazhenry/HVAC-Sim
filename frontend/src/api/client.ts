import type {
  CatalogResponse,
  EquipmentContext,
  ChatRequest,
  ChatResponse,
  ExamPaper,
  ExamResult,
  ExamSection,
  ExamSectionInfo,
  GradeResponse,
  HintResponse,
  SessionResponse,
  SubmitRequest,
  VisitsPage,
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
  validateContext: (context: unknown) => request<EquipmentContext>('/contexts/validate', post(context)),
  feedback: (replyId: string, rating: 'up' | 'down', explanation: string, user: string) =>
    request<{ id: string }>('/feedback', post({ replyId, rating, explanation, user })),
  visitsAccess: () => request<{ allowed: boolean }>('/visits/access', { cache: 'no-store' }),
  visits: (search: string, offset: number, limit: number, signal: AbortSignal) =>
    request<VisitsPage>(`/visits?${new URLSearchParams({ search, offset: String(offset), limit: String(limit) })}`,
      { cache: 'no-store', signal }),
  trackVisit: (visitId: string, appVersion: string, event = 'home', user?: string) =>
    request<{ status: string }>('/visits', { ...post({ visitId, appVersion, event, user }), keepalive: true }),
  catalog: () => request<CatalogResponse>('/catalog'),
  startSession: (scenarioId: string, context?: EquipmentContext) => request<SessionResponse>('/sessions', post({ scenarioId, context })),
  hint: (sessionId: string) => request<HintResponse>(`/sessions/${sessionId}/hint`, post()),
  chat: (sessionId: string, body: ChatRequest) =>
    request<ChatResponse>(`/sessions/${sessionId}/chat`, post(body)),
  examSections: () => request<ExamSectionInfo[]>('/exam'),
  examPaper: (section: ExamSection) => request<ExamPaper>(`/exam/${section}`),
  gradeExam: (section: ExamSection, answers: Record<string, number>) =>
    request<ExamResult>(`/exam/${section}/grade`, post({ answers })),
  submit: (sessionId: string, body: SubmitRequest) =>
    request<GradeResponse>(`/sessions/${sessionId}/submit`, post(body)),
};
