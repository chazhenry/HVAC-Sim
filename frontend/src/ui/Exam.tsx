import { type ReactNode, useEffect, useState } from 'react';
import { api } from '../api/client';
import { rememberedGuestName } from '../store/guest';
import { progressForUser, useTrainingProgress } from '../store/useTrainingProgress';
import type { ExamPaper, ExamResult, ExamSection, ExamSectionInfo } from '../api/types';

/** Menu block listing the EPA 608 practice sections. */
export function ExamSections({ onPick }: { onPick: (section: ExamSection) => void }): ReactNode {
  const user = rememberedGuestName();
  const progress = useTrainingProgress((state) => progressForUser(state.profiles, user));
  const [sections, setSections] = useState<ExamSectionInfo[] | null>(null);
  useEffect(() => {
    let live = true;
    api
      .examSections()
      .then((s) => live && setSections(s))
      .catch(() => live && setSections([]));
    return () => {
      live = false;
    };
  }, []);
  if (!sections || sections.length === 0) return null;
  return (
    <section className="unit-group">
      <h3>EPA Section 608 - practice exams</h3>
      <ul className="scenarios">
        {sections.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(s.id)}>
              <span className="pill exam">{s.questionCount} questions</span>
              <strong>{s.title}</strong>
              <span className="complaint">{s.covers}</span>
              {progress.exams[s.id] && <span className="training-result">Best practice score: {progress.exams[s.id]!.bestPercent}% · {progress.exams[s.id]!.passed ? 'Practice passed' : 'Keep practicing'}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="fine">
        Universal preparation covers Core plus Types I, II and III. These are original practice
        questions. Certification requires testing through an EPA-approved organization.
      </p>
    </section>
  );
}

export function Exam({ section, onClose }: { section: ExamSection; onClose: () => void }): ReactNode {
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .examPaper(section)
      .then((p) => live && setPaper(p))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [section]);

  const grade = async (): Promise<void> => {
    const user = rememberedGuestName();
    setBusy(true);
    setError(null);
    try {
      const graded = await api.gradeExam(section, answers);
      useTrainingProgress.getState().recordExam(section, graded, user);
      setResult(graded);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const retake = (): void => {
    setAnswers({});
    setResult(null);
  };

  const answered = Object.keys(answers).length;
  const byId = new Map(result?.results.map((r) => [r.id, r]));
  return (
    <div className="overlay">
      <div className="dialog wide exam">
        <header className="exam-head">
          <div>
            <h2>EPA 608 practice - {paper?.section.title ?? '…'}</h2>
            <p className="fine">{paper?.section.covers}</p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {result && (
          <div className="score-head">
            <div className={`score ${result.passed ? 'good' : 'bad'}`}>{result.percent}%</div>
            <div>
              <h2>{result.passed ? 'Pass' : 'Not yet'}</h2>
              <p className="fine">
                {result.correct} of {result.total} correct. {paper?.passPercent}% is needed to pass. Read the
                explanation under each question.
              </p>
            </div>
          </div>
        )}
        <ol className="questions">
          {paper?.questions.map((q) => {
            const r = byId.get(q.id);
            return (
              <li key={q.id}>
                <p className="prompt">{q.prompt}</p>
                <div className="choices">
                  {q.choices.map((choice, i) => {
                    const picked = answers[q.id] === i;
                    const mark = r ? (i === r.correctIndex ? ' right' : picked ? ' wrong' : '') : picked ? ' picked' : '';
                    return (
                      <label key={choice} className={mark.trim()}>
                        <input
                          type="radio"
                          name={q.id}
                          checked={picked}
                          disabled={result !== null}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                        />
                        {choice}
                      </label>
                    );
                  })}
                </div>
                {r && <p className={`explain ${r.correct ? 'ok' : 'miss'}`}>{r.explanation}</p>}
              </li>
            );
          })}
        </ol>
        <div className="actions">
          {result ? (
            <button type="button" className="primary" onClick={retake}>
              Try again
            </button>
          ) : (
            <button type="button" className="primary" disabled={!paper || busy} onClick={() => void grade()}>
              Grade exam ({answered} of {paper?.questions.length ?? 0} answered)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
