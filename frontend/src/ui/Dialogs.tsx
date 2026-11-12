import { type ReactNode, useState } from 'react';
import type { Difficulty, UnitType, EquipmentContext } from '../api/types';
import { EquipmentPicker } from './EquipmentPicker';
import type { ExamSection } from '../api/types';
import { useSim } from '../store/useSim';
import { Exam, ExamSections } from './Exam';
import { APP_VERSION } from '../version';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  intro: 'Intro',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const UNIT_TITLE: Record<UnitType, string> = {
  condenser: 'A/C condenser - split system, R-410A',
  furnace: 'Gas furnace - 80% single stage, hot-surface ignition',
};

export function Menu(): ReactNode {
  const catalog = useSim((s) => s.catalog);
  const error = useSim((s) => s.error);
  const busy = useSim((s) => s.busy);
  const start = useSim((s) => s.startScenario);
  const reload = useSim((s) => s.loadCatalog);
  const [exam, setExam] = useState<ExamSection | null>(null);
  const [chosen, setChosen] = useState<EquipmentContext | null>(null);
  const context = chosen ?? catalog?.contexts[0] ?? null;
  if (exam) return <Exam section={exam} onClose={() => setExam(null)} />;
  return (
    <div className="overlay">
      <div className="dialog wide">
        <h1>HVAC-Sim <span className="app-version">(v{APP_VERSION})</span></h1>
        <p className="lede">
          Pick a service call, find the fault with real instruments, make the repair and prove the
          equipment runs.
        </p>
        {catalog && context && <EquipmentPicker contexts={catalog.contexts} selected={context} onSelect={setChosen} />}
        {error && (
          <div className="error" role="alert">
            <p>{error}</p>
            {!catalog && (
              <button type="button" onClick={() => void reload()}>
                Retry
              </button>
            )}
          </div>
        )}
        {!catalog && !error && <p>Loading service calls…</p>}
        {catalog &&
          (Object.keys(UNIT_TITLE) as UnitType[]).filter((unit) => !context || context.unitType === unit).map((unit) => (
          <section key={unit} className="unit-group">
          <h3>{context?.systemType === 'heat_pump' ? context.name : UNIT_TITLE[unit]}</h3>
          <ul className="scenarios">
            {catalog.scenarios.filter((s) => s.unitType === unit && (!s.id.startsWith('hp-') || context?.systemType === 'heat_pump')).map((s) => (
              <li key={s.id}>
                <button type="button" disabled={busy} onClick={() => void start(s.id, context ?? undefined)}>
                  <span className={`pill ${s.difficulty}`}>{DIFFICULTY_LABEL[s.difficulty]}</span>
                  <strong>{s.title}</strong>
                  <span className="complaint">{s.complaint}</span>
                </button>
              </li>
            ))}
          </ul>
          </section>
          ))}
        {catalog && <ExamSections onPick={setExam} />}
      </div>
    </div>
  );
}

export function SubmitDialog({ onClose }: { onClose: () => void }): ReactNode {
  const unitType = useSim((s) => s.unitType);
  const all = useSim((s) => s.catalog?.diagnoses);
  const diagnoses = (all ?? []).filter((d) => d.unitType === unitType);
  const busy = useSim((s) => s.busy);
  const error = useSim((s) => s.error);
  const submit = useSim((s) => s.submit);
  const [choice, setChoice] = useState<string | null>(null);
  return (
    <div className="overlay">
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice) void submit(choice);
        }}
      >
        <h2>Close out the job</h2>
        <p className="fine">
          What was wrong with the unit? You are graded on the diagnosis, the repair, leaving the unit
          running in spec, safety and refitting the panels.
        </p>
        <div className="choices">
          {diagnoses.map((d) => (
            <label key={d.id} className={choice === d.id ? 'picked' : ''}>
              <input type="radio" name="diagnosis" value={d.id} checked={choice === d.id} onChange={() => setChoice(d.id)} />
              {d.label}
            </label>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>
            Keep working
          </button>
          <button type="submit" className="primary" disabled={!choice || busy}>
            Submit diagnosis
          </button>
        </div>
      </form>
    </div>
  );
}

export function ResultDialog(): ReactNode {
  const result = useSim((s) => s.result);
  const back = useSim((s) => s.backToMenu);
  if (!result) return null;
  return (
    <div className="overlay">
      <div className="dialog">
        <div className="score-head">
          <div className={`score ${result.score >= 80 ? 'good' : result.score >= 50 ? 'ok' : 'bad'}`}>{result.score}</div>
          <div>
            <h2>{result.diagnosisCorrect ? 'Correct diagnosis' : 'Not quite'}</h2>
            <p className="fine">Actual fault: {result.correctDiagnosis.label}</p>
          </div>
        </div>
        <table className="breakdown">
          <tbody>
            {result.breakdown.map((line) => (
              <tr key={line.label}>
                <th scope="row">{line.label}</th>
                <td className="num">{line.maxPoints > 0 ? `${line.points} / ${line.maxPoints}` : line.points}</td>
                <td>{line.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>What was going on</h3>
        <p>{result.explanation}</p>
        <div className="actions">
          <button type="button" className="primary" onClick={back}>
            Next service call
          </button>
        </div>
      </div>
    </div>
  );
}
