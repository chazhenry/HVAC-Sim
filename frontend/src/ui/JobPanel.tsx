import { type ReactNode, useState } from 'react';
import { useSim } from '../store/useSim';
import { ChatPanel } from './ChatPanel';
import { EquipmentStatus } from './EquipmentStatus';
import { ProcedureProgress } from './ProcedureProgress';
import { Instruments, useInstrumentNames } from './Instruments';

/**
 * A card whose body folds away behind a chevron. `summary` stays visible when
 * it is collapsed. The open/closed choice is remembered per card in the browser.
 */
function CollapsibleCard(props: {
  id: string;
  title: string;
  /** Shown after the title in the accent colour, e.g. what the card currently holds. */
  detail?: string;
  summary?: ReactNode;
  children: ReactNode;
}): ReactNode {
  const { id, title, detail, summary, children } = props;
  const key = `hvac-sim.card.${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(key) !== 'closed';
    } catch {
      return true;
    }
  });
  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(key, next ? 'open' : 'closed');
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  };
  return (
    <section className="card">
      <button
        type="button"
        className="card-toggle"
        aria-expanded={open}
        aria-controls={`card-${id}`}
        title={`${open ? 'Collapse' : 'Expand'} ${title.toLowerCase()}`}
        onClick={toggle}
      >
        <h2>
          {title}
          {detail && (
            <>
              : <span className="card-detail">{detail}</span>
            </>
          )}
        </h2>
        <svg className={open ? 'chev open' : 'chev'} viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
          <path d="M3 6 L8 11 L13 6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {summary}
      {open && (
        <div id={`card-${id}`} className="card-body">
          {children}
        </div>
      )}
    </section>
  );
}

/** Right-hand pane: the work order and instrument readouts, with the chat filling the rest. */
export function JobPanel(): ReactNode {
  const scenario = useSim((s) => s.scenario);
  const instruments = useInstrumentNames().join(', ');
  if (!scenario) return null;
  return (
    <aside className="jobpanel">
      <div className="jobpanel-top">
        <CollapsibleCard id="work-order" title="Work order" summary={<h3 className="job-title">{scenario.title}</h3>}>
          <p className="complaint">{scenario.complaint}</p>
        </CollapsibleCard>

        <EquipmentStatus />
        <ProcedureProgress />

        <CollapsibleCard id="instruments" title="Instruments" {...(instruments ? { detail: instruments } : {})}>
          <Instruments />
        </CollapsibleCard>
      </div>
      <ChatPanel />
    </aside>
  );
}
