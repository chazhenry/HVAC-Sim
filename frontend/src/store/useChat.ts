import { create } from 'zustand';
import { api } from '../api/client';
import { chatState } from '../ui/observations';
import { useSim } from './useSim';

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'error';
  content: string;
}

const HISTORY_KEY = 'hvac-sim.chat-prompts';
const HISTORY_LIMIT = 100;

/** Earlier prompts, newest first; a per-browser convenience like a shell history. */
function loadPrompts(): string[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string').slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function savePrompts(prompts: string[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(prompts));
  } catch {
    // Storage can be blocked; the history then lasts for this visit only.
  }
}

interface ChatState {
  /** Job the messages belong to; a new job starts a new conversation. */
  sessionId: string | null;
  messages: ChatMessage[];
  pending: boolean;
  /** Last-in, first-out: index 0 is the most recent prompt. */
  prompts: string[];
  send: (text: string) => Promise<void>;
}

let nextId = 0;

export const useChat = create<ChatState>()((set, get) => ({
  sessionId: null,
  messages: [],
  pending: false,
  prompts: loadPrompts(),

  send: async (text) => {
    const message = text.trim();
    const sim = useSim.getState();
    const { sessionId } = sim;
    if (!message || sessionId === null) return;
    // A reply still pending for a job that has since been left does not block the new one.
    if (get().pending && get().sessionId === sessionId) return;

    const fresh = get().sessionId !== sessionId;
    const earlier = fresh ? [] : get().messages;
    const prompts = [message, ...get().prompts.filter((p) => p !== message)].slice(0, HISTORY_LIMIT);
    savePrompts(prompts);
    set({
      sessionId,
      pending: true,
      prompts,
      messages: [...earlier, { id: ++nextId, role: 'user', content: message }],
    });

    const history = earlier
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'error')
      .map(({ role, content }) => ({ role, content }));
    let reply: ChatMessage;
    try {
      const res = await api.chat(sessionId, { message, history, state: chatState(sim) });
      reply = { id: ++nextId, role: 'assistant', content: res.reply };
    } catch (e) {
      reply = { id: ++nextId, role: 'error', content: e instanceof Error ? e.message : String(e) };
    }
    // The learner may have left the job while the reply was on its way.
    if (get().sessionId !== sessionId) return;
    set((s) => ({ pending: false, messages: [...s.messages, reply] }));
  },
}));
