import { type ReactNode, useEffect, useState } from 'react';
import { F_VIEWS } from './scene/furnaceLayout';
import { VIEWS } from './scene/layout';
import { Scene, useView } from './scene/Scene';
import { useSim } from './store/useSim';
import { Menu, ResultDialog, SubmitDialog } from './ui/Dialogs';
import { JobPanel } from './ui/JobPanel';
import { ThermostatWidget } from './ui/Thermostat';
import { Toolbox } from './ui/Toolbox';
import { toolCursor } from './ui/toolIcons';
import { WiringDiagram } from './ui/WiringDiagram';

const TICK_SECONDS = 0.1;

function TopBar({ onSubmit, onDiagram }: { onSubmit: () => void; onDiagram: () => void }): ReactNode {
  const go = useView((s) => s.go);
  const views = useSim((s) => (s.unitType === 'furnace' ? F_VIEWS : VIEWS));
  const hints = useSim((s) => s.hints.length);
  const hintsTotal = useSim((s) => s.hintsTotal);
  const requestHint = useSim((s) => s.requestHint);
  const back = useSim((s) => s.backToMenu);
  const exhausted = hintsTotal > 0 && hints >= hintsTotal;
  return (
    <header className="topbar">
      <strong className="brand">HVAC-Sim</strong>
      <nav className="views" aria-label="Camera views">
        {views.map((view) => (
          <button key={view.label} type="button" onClick={() => go(view)}>
            {view.label}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      <button type="button" className="ghost" onClick={onDiagram}>
        Wiring diagram
      </button>
      <button type="button" className="ghost" onClick={() => void requestHint()} disabled={exhausted}>
        {exhausted ? 'No hints left' : `Hint (−5 pts)${hints ? ` · ${hints} used` : ''}`}
      </button>
      <button type="button" className="ghost" onClick={back}>
        Abandon job
      </button>
      <button type="button" className="primary" onClick={onSubmit}>
        Complete job
      </button>
    </header>
  );
}

function HoverBar(): ReactNode {
  const hover = useSim((s) => s.hover);
  return (
    <div className="hoverbar" aria-hidden={hover === null}>
      {hover ?? 'Drag to orbit · scroll to zoom · right-drag to pan'}
    </div>
  );
}

export function App(): ReactNode {
  const phase = useSim((s) => s.phase);
  const loadCatalog = useSim((s) => s.loadCatalog);
  const tick = useSim((s) => s.tick);
  const tool = useSim((s) => s.tool);
  const sessionId = useSim((s) => s.sessionId);
  const [submitting, setSubmitting] = useState(false);
  const [diagram, setDiagram] = useState(false);

  // Frame the right piece of equipment whenever a new job starts.
  useEffect(() => {
    if (sessionId === null) return;
    const first = (useSim.getState().unitType === 'furnace' ? F_VIEWS : VIEWS)[0];
    if (first) useView.getState().go(first);
  }, [sessionId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const id = window.setInterval(() => tick(TICK_SECONDS), TICK_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  useEffect(() => {
    if (phase !== 'running') setSubmitting(false);
  }, [phase]);

  const inJob = phase === 'running' || phase === 'graded';
  return (
    <div className="app">
      {inJob && <TopBar onSubmit={() => setSubmitting(true)} onDiagram={() => setDiagram((v) => !v)} />}
      <main className="stage">
        {inJob && <Toolbox />}
        <div className="viewport" style={inJob ? { cursor: toolCursor(tool) } : undefined}>
          <Scene />
          {inJob && <HoverBar />}
          {inJob && <ThermostatWidget />}
          {inJob && diagram && <WiringDiagram onClose={() => setDiagram(false)} />}
        </div>
        {inJob && <JobPanel />}
      </main>
      {(phase === 'menu' || phase === 'loading') && <Menu />}
      {phase === 'running' && submitting && <SubmitDialog onClose={() => setSubmitting(false)} />}
      {phase === 'graded' && <ResultDialog />}
    </div>
  );
}
