import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useChat } from '../store/useChat';
import { useSim } from '../store/useSim';
import { JOB_LOG_TOAST_CLOSED } from './JobLogToasts';
import { ChatMessage } from './ChatMessage';
import { ReplyFeedback } from './ReplyFeedback';
import { isPowerCommand, usePowerCommands } from '../store/usePowerCommands';

function Log(): ReactNode {
  const log = useSim((s) => s.log);
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [log.length]);
  return (
    <ol className="log" aria-live="polite">
      {log.map((entry) => (
        <li key={entry.id} className={`log-${entry.kind}`}>
          <time>{`${Math.floor(entry.t / 60)}:${String(Math.floor(entry.t % 60)).padStart(2, '0')}`}</time>
          {entry.text}
        </li>
      ))}
      <li ref={end} />
    </ol>
  );
}

const SendIcon = (): ReactNode => (
  <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
    <path d="M3.4 20.4 21 12 3.4 3.6 3 10.2l11 1.8-11 1.8z" fill="currentColor" />
  </svg>
);

const Spinner = (): ReactNode => (
  <svg className="spin" viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
    <circle cx={12} cy={12} r={9} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
    <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
  </svg>
);

function Chat(): ReactNode {
  const jobId = useSim((s) => s.sessionId);
  const chatJob = useChat((s) => s.sessionId);
  const all = useChat((s) => s.messages);
  const pending = useChat((s) => s.pending && s.sessionId === jobId);
  const prompts = useChat((s) => s.prompts);
  const send = useChat((s) => s.send);
  const listMode = usePowerCommands((s) => s.listMode);
  const executeCommand = usePowerCommands((s) => s.execute);
  const messages = chatJob === jobId ? all : [];

  const [draft, setDraft] = useState('');
  const commandDraft = isPowerCommand(draft);
  const waiting = pending && !commandDraft;
  /** Position in the prompt history; -1 is the text being typed now. */
  const [recall, setRecall] = useState(-1);
  const typed = useRef('');
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, pending]);

  // Hand the keyboard back once the reply has arrived.
  useEffect(() => {
    if (!pending) box.current?.focus({ preventScroll: true });
  }, [pending]);

  const submit = (): void => {
    if (waiting || !draft.trim()) return;
    void send(draft);
    setDraft('');
    setRecall(-1);
    typed.current = '';
  };

  const step = (delta: 1 | -1): void => {
    const next = Math.min(prompts.length - 1, Math.max(-1, recall + delta));
    if (next === recall) return;
    if (recall === -1) typed.current = draft;
    setRecall(next);
    setDraft(next === -1 ? typed.current : (prompts[next] ?? ''));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      step(1);
    } else if (e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat">
      <div className="chat-stream" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty">
            Ask the tutor about this job. It sees what you see: the work order, your readings and the job log. Ctrl+↑ and
            Ctrl+↓ recall earlier prompts. Use /l to toggle cursor part labels.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}${m.kind === 'power_command' ? ' power-command' : ''}`}>
            <ChatMessage content={m.content} />
            {m.role === 'assistant' && !m.kind && m.replyId && m.prompt &&
              <ReplyFeedback replyId={m.replyId} prompt={m.prompt} answer={m.content} />}
          </div>
        ))}
        {pending && <p className="bubble assistant thinking"><Spinner /> Thinking…</p>}
        <div ref={end} />
      </div>
      <div className="chat-input">
        <textarea
          ref={box}
          rows={2}
          value={draft}
          maxLength={2000}
          placeholder={pending ? 'Tutor is thinking… /l toggles cursor labels.' : 'Ask the tutor… / for commands'}
          aria-label="Message to the tutor"
          onChange={(e) => {
            setDraft(e.target.value);
            setRecall(-1);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="chat-list-mode"
          aria-label={listMode ? 'Hide cursor part labels' : 'Show cursor part labels'}
          aria-pressed={listMode}
          title={`List mode ${listMode ? 'on' : 'off'} — click to ${listMode ? 'hide' : 'show'} part labels (/l)`}
          onClick={() => executeCommand('/l')}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx={12} cy={12} r={3} />
            {!listMode && <path d="m3 3 18 18" />}
          </svg>
        </button>
        <button
          type="button"
          className="chat-send"
          aria-label={waiting ? 'Waiting for reply' : commandDraft ? 'Run power command' : 'Send'}
          title={waiting ? 'Waiting for reply' : commandDraft ? 'Run power command (Enter)' : 'Send (Enter)'}
          disabled={waiting || !draft.trim()}
          onClick={submit}
        >
          {waiting ? <Spinner /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}

type Tab = 'chat' | 'log';

/** Bottom of the right-hand pane: the tutor chat and the job log, as tabs. */
export function ChatPanel(): ReactNode {
  const [tab, setTab] = useState<Tab>('chat');
  const [sparkle, setSparkle] = useState<number | null>(null);
  const sparkleId = useRef(0);
  useEffect(() => {
    const flash = (): void => setSparkle(++sparkleId.current);
    window.addEventListener(JOB_LOG_TOAST_CLOSED, flash);
    return () => window.removeEventListener(JOB_LOG_TOAST_CLOSED, flash);
  }, []);
  const logCount = useSim((s) => s.log.length);
  const [seen, setSeen] = useState(logCount);
  useEffect(() => {
    if (tab === 'log') setSeen(logCount);
  }, [tab, logCount]);
  const unread = Math.max(0, logCount - seen);

  return (
    <section className="card grow tabs-card">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>
          Chat
        </button>
        <button id="job-log-tab" type="button" role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
          Job Log
          <span className="job-log-sparkle-slot" aria-hidden="true">
            {sparkle !== null && <svg key={sparkle} className="job-log-sparkle" viewBox="0 0 24 24"
              onAnimationEnd={() => setSparkle(null)}>
              <path d="m10 3 2.5 6.5L19 12l-6.5 2.5L10 21l-2.5-6.5L1 12l6.5-2.5Z" />
              <path d="m20 1 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
            </svg>}
          </span>
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
      </div>
      {/* Both stay mounted so a half-typed prompt survives a look at the log. */}
      <div className="tab-body" hidden={tab !== 'chat'}>
        <Chat />
      </div>
      <div className="tab-body" hidden={tab !== 'log'}>
        <Log />
      </div>
    </section>
  );
}
