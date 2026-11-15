import { type ReactNode, useEffect, useState } from "react";
import type {
  CatalogResponse,
  Difficulty,
  EquipmentContext,
  ExamSection,
  ScenarioSummary,
} from "../api/types";
import { rememberedGuestName } from "../store/guest";
import {
  progressForUser,
  useTrainingProgress,
  type TrainingProgress,
} from "../store/useTrainingProgress";
import {
  compatibleScenarios,
  mappedScenarios,
  skillsForScenario,
  training,
  type TrainingTrack,
} from "../training/catalog";
import { EquipmentPicker } from "./EquipmentPicker";
import { tracks } from "../training/tracks";
import { ExamSections } from "./Exam";

const difficulties: Record<Difficulty, string> = {
  intro: "Intro",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function ScenarioCards({
  scenarios,
  busy,
  progress,
  showSkills,
  onStart,
}: {
  scenarios: ScenarioSummary[];
  busy: boolean;
  progress: TrainingProgress;
  showSkills: boolean;
  onStart: (id: string) => void;
}): ReactNode {
  return (
    <ul className="scenarios">
      {scenarios.map((scenario) => {
        const saved = progress.jobs[scenario.id];
        return (
          <li key={scenario.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStart(scenario.id)}
            >
              <span className={`pill ${scenario.difficulty}`}>
                {difficulties[scenario.difficulty]}
              </span>
              <strong>{scenario.title}</strong>
              <span className="complaint">{scenario.complaint}</span>
              {showSkills && (
                <span className="training-scenario-skills">
                  {skillsForScenario(scenario.id)
                    .map((skill) => skill.label)
                    .join(" · ")}
                </span>
              )}
              {saved && (
                <span
                  className={`training-result${saved.completed ? " complete" : ""}`}
                >
                  {saved.completed ? "✓ Practice completed" : "In progress"} ·
                  Best {saved.bestScore}/100
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type JobStage = "all" | "intro" | "easy" | "medium" | "hard";

/** Stage filter for the Job cards, one pill per difficulty plus "All". */
const JOB_STAGES: ReadonlyArray<{ id: JobStage; label: string }> = [
  { id: "all", label: "All" },
  { id: "intro", label: "Intro" },
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

export function TrainingMenu({
  catalog,
  context,
  onContext,
  busy,
  onStart,
  onExam,
  track,
  onTrackChange,
}: {
  catalog: CatalogResponse;
  context: EquipmentContext | null;
  onContext: (context: EquipmentContext) => void;
  busy: boolean;
  onStart: (id: string, context?: EquipmentContext) => void;
  onExam: (section: ExamSection) => void;
  track: TrainingTrack;
  onTrackChange: (track: TrainingTrack) => void;
}): ReactNode {
  const [domain, setDomain] = useState("electrical");
  const [skillId, setSkillId] = useState<string | null>(null);
  const [stage, setStage] = useState<JobStage>("easy");
  const user = rememberedGuestName();
  const progress = useTrainingProgress((state) =>
    progressForUser(state.profiles, user),
  );
  useEffect(() => {
    useTrainingProgress.getState().hydrate(user);
  }, [user]);
  const mapped = mappedScenarios(track, domain, skillId);
  const relevant = catalog.scenarios.filter(
    (scenario) => !mapped || mapped.has(scenario.id),
  );
  const visible = compatibleScenarios(relevant, context);
  const staged = stage === "all" ? visible : visible.filter((scenario) => scenario.difficulty === stage);
  const alternative = catalog.contexts.find(
    (item) => compatibleScenarios(relevant, item).length > 0,
  );
  const skills = training.skills.filter(
    (skill) => skill.domain === domain && (!skillId || skill.id === skillId),
  );
  const sources = training.sources.filter((source) =>
    skills.some((skill) => skill.sourceIds.includes(source.id)),
  );
  const selectedDomain = training.domains.find((item) => item.id === domain)!;
  return (
    <>
      <section
        className="menu-card training-mode"
        aria-labelledby="training-mode-title"
      >
        <h2 id="training-mode-title">1. Training Mode</h2>
        <div
          className="training-tabs"
          role="tablist"
          aria-labelledby="training-mode-title"
        >
          {tracks.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`track-${item.id}`}
              aria-selected={track === item.id}
              aria-controls="training-panel"
              onClick={() => onTrackChange(item.id)}
            >
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      </section>
      <section
        className="training-panel"
        id="training-panel"
        role="tabpanel"
        aria-labelledby={`track-${track}`}
      >
        {track === "epa" && (
          <>
            <p className="fine">
              Start with Core and Type II for the high-pressure systems modeled
              here. Types I and III have quiz practice only. These exercises do
              not award certification.{" "}
              <a
                href="https://www.epa.gov/section608/section-608-technician-certification-requirements"
                target="_blank"
                rel="noreferrer"
              >
                EPA certification requirements
              </a>
            </p>
            <ExamSections onPick={onExam} />
            <h2>Refrigerant service practice</h2>
          </>
        )}
        {track === "nate" && (
          <>
            <p className="fine">
              Independent practice mapped to selected CHP-5 objectives. Partial
              coverage, not a complete exam course or NATE-endorsed training.{" "}
              <a
                href="https://natex.org/technician/take-an-exam/kate"
                target="_blank"
                rel="noreferrer"
              >
                Published NATE objectives
              </a>
            </p>
            <div
              className="training-domains"
              role="group"
              aria-label="CHP-5 domains"
            >
              {training.domains.map((item) => {
                const ids = new Set(
                  training.skills
                    .filter((skill) => skill.domain === item.id)
                    .flatMap((skill) => skill.scenarioIds),
                );
                const done = [...ids].filter(
                  (id) => progress.jobs[id]?.completed,
                ).length;
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={domain === item.id}
                    onClick={() => {
                      setDomain(item.id);
                      setSkillId(null);
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>Partial coverage</span>
                    <progress
                      value={done}
                      max={ids.size || 1}
                      aria-label={`${item.title}: ${done} of ${ids.size} mapped calls completed`}
                    />
                    <span>
                      {done}/{ids.size} practice calls completed
                    </span>
                  </button>
                );
              })}
            </div>
            <div
              className="training-skill-filters"
              role="group"
              aria-label="Filter by skill"
            >
              <button
                type="button"
                aria-pressed={!skillId}
                onClick={() => setSkillId(null)}
              >
                All {selectedDomain.title.toLowerCase()}
              </button>
              {training.skills
                .filter((skill) => skill.domain === domain)
                .map((skill) => (
                  <button
                    type="button"
                    key={skill.id}
                    aria-pressed={skillId === skill.id}
                    onClick={() => setSkillId(skill.id)}
                  >
                    {skill.label}
                  </button>
                ))}
            </div>
            <details className="training-coverage">
              <summary>
                Mapped skill objectives, coverage limits and sources
              </summary>
              <div className="training-coverage-body">
                {skills.map((skill) => {
                  const done = skill.scenarioIds.filter(
                    (id) => progress.jobs[id]?.completed,
                  ).length;
                  return (
                    <p key={skill.id}>
                      <strong>
                        {skill.label} ({done}/{skill.scenarioIds.length})
                      </strong>{" "}
                      — {skill.objective}
                    </p>
                  );
                })}
                <p className="fine">
                  <strong>Coverage limits:</strong> {selectedDomain.gap}
                </p>
                <p className="fine">
                  Sources:{" "}
                  {sources.map((source, index) => (
                    <span key={source.id}>
                      {index > 0 && " · "}
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.label}
                      </a>
                    </span>
                  ))}
                </p>
              </div>
            </details>
            <details className="training-progress-notes">
              <summary>How practice progress is counted</summary>
              <p className="fine">
                Counts include mapped calls across all equipment. Completion
                requires a score of at least 80, correct diagnosis, full
                repair/procedure and operation credit, and no safety deductions.
                These counts measure simulator practice, not certification
                readiness. Progress is saved for your account email in this
                browser.
              </p>
            </details>
          </>
        )}
        {context && (
          <EquipmentPicker
            contexts={catalog.contexts}
            selected={context}
            onSelect={onContext}
          />
        )}
        <section className="menu-card unit-group" aria-labelledby="job-title">
          <div className="job-heading">
            <h2 id="job-title">3. Job</h2>
            <div className="job-stages" role="group" aria-label="Show jobs by stage">
              {JOB_STAGES.map((item) => (
                <button key={item.id} type="button" className={`pill stage-pill ${item.id}`}
                  aria-pressed={stage === item.id} onClick={() => setStage(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <h3>{context?.name ?? "Service calls"}</h3>
          {visible.length > 0 && staged.length === 0 ? (
            <div className="training-empty">
              <p>No {stage} jobs for this equipment and training mode.</p>
              <button type="button" onClick={() => setStage("all")}>Show all jobs</button>
            </div>
          ) : visible.length > 0 ? (
            <ScenarioCards
              scenarios={staged}
              busy={busy}
              progress={progress}
              showSkills={track === "nate"}
              onStart={(id) => onStart(id, context ?? undefined)}
            />
          ) : (
            <div className="training-empty">
              <p>
                No mapped calls for this equipment. Choose another context
                {alternative ? `, such as ${alternative.name}` : ""}.
              </p>
              {alternative && (
                <button type="button" onClick={() => onContext(alternative)}>
                  Use {alternative.name}
                </button>
              )}
            </div>
          )}
        </section>
      </section>
    </>
  );
}
