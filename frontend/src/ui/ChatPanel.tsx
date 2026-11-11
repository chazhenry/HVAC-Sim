import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useChat } from '../store/useChat';
import { useSim } from '../store/useSim';

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
  const messages = chatJob === jobId ? all : [];

  const [draft, setDraft] = useState('');
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
    if (pending || !draft.trim()) return;
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
            Ctrl+↓ recall earlier prompts.
          </p>
        )}
        {messages.map((m) => (
          <p key={m.id} className={`bubble ${m.role}`}>
            {m.content}
          </p>
        ))}
        {pending && <p className="bubble assistant thinking">Thinking…</p>}
        <div ref={end} />
      </div>
      <div className="chat-input">
        <textarea
          ref={box}
          rows={2}
          value={draft}
          disabled={pending}
          maxLength={2000}
          placeholder={pending ? 'Waiting for the tutor…' : 'Ask the tutor…'}
          aria-label="Message to the tutor"
          onChange={(e) => {
            setDraft(e.target.value);
            setRecall(-1);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="chat-send"
          aria-label={pending ? 'Waiting for reply' : 'Send'}
          title={pending ? 'Waiting for reply' : 'Send (Enter)'}
          disabled={pending || !draft.trim()}
          onClick={submit}
        >
          {pending ? <Spinner /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}

type Tab = 'chat' | 'log';

/** Bottom of the right-hand pane: the tutor chat and the job log, as tabs. */
export function ChatPanel(): ReactNode {
  const [tab, setTab] = useState<Tab>('chat');
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
        <button type="button" role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'on' : ''} onClick={() => setTab('log')}>
          Job Log
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
