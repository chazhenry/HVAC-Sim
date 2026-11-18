import type {
  AuthResponse,
  AuthUser,
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
import { useAuth } from '../store/useAuth';
import type { ModelSettings, VideoInfo } from './types';
import { APP_VERSION } from '../version';

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

/** Full address of an API path such as a video's signed link. */
export const apiUrl = (path: string): string => `${API_BASE}${path}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const token = useAuth.getState().token;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError('Cannot reach the HVAC-Sim API. Is the backend running?', 0);
  }
  if (!res.ok) {
    if (res.status === 401 && token && useAuth.getState().token === token && path !== '/auth/login' && path !== '/auth/register') useAuth.getState().clearSession();
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      // Non-JSON error body (e.g. the dev proxy failing): keep the status text.
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return res.status === 204 ? undefined as T : await res.json() as T;
}

const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const api = {
  register: (email: string, fname: string, lname: string, password: string, confirmPassword: string) =>
    request<AuthResponse>('/auth/register', post({ email, fname, lname, password, confirmPassword })),
  login: (email: string, password: string) => request<AuthResponse>('/auth/login', post({ email, password })),
  currentUser: () => request<AuthUser>('/auth/me'),
  logout: () => request<void>('/auth/logout', post()),
  validateContext: (context: unknown) => request<EquipmentContext>('/contexts/validate', post(context)),
  feedback: (replyId: string, rating: 'up' | 'down', explanation: string, user: string) =>
    request<{ id: string }>('/feedback', post({ replyId, rating, explanation, user })),
  visitsAccess: () => request<{ allowed: boolean }>('/visits/access', { cache: 'no-store' }),
  visits: (search: string, offset: number, limit: number, signal: AbortSignal) =>
    request<VisitsPage>(`/visits?${new URLSearchParams({ search, offset: String(offset), limit: String(limit) })}`,
      { cache: 'no-store', signal }),
  trackVisit: (visitId: string, appVersion: string, event = 'home', user?: string, note?: string) =>
    request<{ status: string }>('/visits', { ...post({ visitId, appVersion, event, user, note }), keepalive: true }),
  catalog: () => request<CatalogResponse>('/catalog'),
  startSession: (scenarioId: string, context?: EquipmentContext) => request<SessionResponse>('/sessions', post({ scenarioId, context })),
  hint: (sessionId: string) => request<HintResponse>(`/sessions/${sessionId}/hint`, post()),
  chat: (sessionId: string, body: ChatRequest) =>
    request<ChatResponse>(`/sessions/${sessionId}/chat`, post({ ...body, appVersion: APP_VERSION })),
  videos: () => request<VideoInfo[]>('/videos'),
  models: () => request<ModelSettings>('/models'),
  setModels: (change: { chatbot?: string; router?: string }) =>
    request<ModelSettings>('/models', { method: 'PUT', body: JSON.stringify(change) }),
  examSections: () => request<ExamSectionInfo[]>('/exam'),
  examPaper: (section: ExamSection) => request<ExamPaper>(`/exam/${section}`),
  gradeExam: (section: ExamSection, answers: Record<string, number>) =>
    request<ExamResult>(`/exam/${section}/grade`, post({ answers })),
  submit: (sessionId: string, body: SubmitRequest) =>
    request<GradeResponse>(`/sessions/${sessionId}/submit`, post(body)),
};
