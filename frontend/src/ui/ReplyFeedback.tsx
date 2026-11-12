import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { rememberedGuestName } from '../store/guest';

type Rating = 'up' | 'down';

function Thumb({ down = false }: { down?: boolean }): ReactNode {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7"
    style={down ? { transform: 'rotate(180deg)' } : undefined} aria-hidden="true">
    <path d="M7 10h-4v11h4zm0 0 5-8c2 0 3 2 2 5l-1 3h6c2 0 3 1 2 4l-2 6H7Z" strokeLinejoin="round" />
  </svg>;
}

function FeedbackDialog(props: { replyId: string; prompt: string; answer: string; rating: Rating;
  initial: string; onClose: () => void; onSaved: (explanation: string) => void }): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const explanationInput = useRef<HTMLTextAreaElement>(null);
  const [explanation, setExplanation] = useState(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = rememberedGuestName();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    explanationInput.current?.focus();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="dialog feedback-dialog" aria-labelledby="feedback-title"
    onCancel={(event) => { if (busy) event.preventDefault(); else props.onClose(); }}>
    <h2 id="feedback-title">{props.rating === 'up' ? 'Helpful reply' : 'Reply needs improvement'}</h2>
    <p className="fine">Feedback from {user}</p>
    <label>Prompt<textarea readOnly rows={3} value={props.prompt} /></label>
    <label>Answer<textarea readOnly rows={6} value={props.answer} /></label>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (busy || !explanation.trim()) return;
      setBusy(true); setError(null);
      void api.feedback(props.replyId, props.rating, explanation.trim(), user)
        .then(() => props.onSaved(explanation.trim()))
        .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Feedback could not be saved.'))
        .finally(() => setBusy(false));
    }}>
      <label>Your explanation<textarea ref={explanationInput} autoFocus required rows={4} maxLength={4000} value={explanation}
        onChange={(event) => setExplanation(event.target.value)} placeholder="Tell us what helped or what should improve." /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" disabled={busy} onClick={props.onClose}>Cancel</button>
        <button type="submit" className="primary" disabled={busy || !explanation.trim() || !user}>{busy ? 'Saving…' : 'Submit feedback'}</button>
      </div>
    </form>
  </dialog>;
}

export function ReplyFeedback({ replyId, prompt, answer }: { replyId: string; prompt: string; answer: string }): ReactNode {
  const [rating, setRating] = useState<Rating | null>(null);
  const [saved, setSaved] = useState<{ rating: Rating; explanation: string } | null>(null);
  return <>
    <div className="reply-feedback" role="group" aria-label="Rate tutor reply">
      <button type="button" title="Helpful reply" aria-label="Thumbs up" aria-pressed={saved?.rating === 'up'} onClick={() => setRating('up')}><Thumb /></button>
      <button type="button" title="Reply needs improvement" aria-label="Thumbs down" aria-pressed={saved?.rating === 'down'} onClick={() => setRating('down')}><Thumb down /></button>
      {saved && <span role="status">Feedback saved</span>}
    </div>
    {rating && <FeedbackDialog replyId={replyId} prompt={prompt} answer={answer} rating={rating} initial={saved?.explanation ?? ''}
      onClose={() => setRating(null)} onSaved={(explanation) => { setSaved({ rating, explanation }); setRating(null); }} />}
  </>;
}
