import type { ReactNode } from 'react';
import { procedureById, procedureProgress } from '../sim/equipment/procedures';
import { useSim } from '../store/useSim';

export function ProcedureProgress(): ReactNode {
  const id = useSim((s) => s.procedureId);
  const journal = useSim((s) => s.equipmentJournal);
  const result = useSim((s) => s.result);
  const procedure = id ? procedureById(id) : undefined;
  if (!procedure) return null;
  const verified = result?.breakdown.some((line) => line.label === 'Verified operation' && line.points === line.maxPoints) ?? false;
  const completed = procedureProgress(procedure, journal.events, verified);
  return <details className="card procedure-progress">
    <summary>{procedure.title} · {completed.size}/{procedure.steps.length}</summary>
    <ol>{procedure.steps.map((step) => <li key={step.id} className={completed.has(step.id) ? 'done' : ''}>
      <span aria-hidden="true">{completed.has(step.id) ? '✓' : '○'}</span> {step.label}
    </li>)}</ol>
    <p className="fine">Measurements and actions supply the evidence. Final operation is checked when you submit the job.</p>
  </details>;
}
