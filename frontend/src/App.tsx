import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api/client';
import { F_VIEWS } from './scene/furnaceLayout';
import { contextViews } from './scene/layout';
import { Scene, useView } from './scene/Scene';
import { useSim } from './store/useSim';
import { Menu, ResultDialog, SubmitDialog } from './ui/Dialogs';
import { JobPanel } from './ui/JobPanel';
import { JobLogToasts } from './ui/JobLogToasts';
import { Splitter, usePaneWidth } from './ui/Splitter';
import { StatusBar } from './ui/StatusBar';
import { ThermostatWidget } from './ui/Thermostat';
import { Toolbox } from './ui/Toolbox';
import { toolCursor } from './ui/toolIcons';
import { WiringDiagram } from './ui/WiringDiagram';
import { VisitsAdmin } from './ui/VisitsAdmin';
import { GuestSignIn } from './ui/GuestSignIn';
import { CursorPartLabel } from './ui/CursorPartLabel';
import { APP_VERSION } from './version';

const TICK_SECONDS = 0.1;

function TopBar({ onSubmit, onDiagram }: { onSubmit: () => void; onDiagram: () => void }): ReactNode {
  const go = useView((s) => s.go);
  const unitType = useSim((s) => s.unitType);
  const context = useSim((s) => s.context);
  const views = useMemo(() => unitType === 'furnace' ? F_VIEWS : contextViews(context), [unitType, context]);
  const hints = useSim((s) => s.hints.length);
  const hintsTotal = useSim((s) => s.hintsTotal);
  const requestHint = useSim((s) => s.requestHint);
  const back = useSim((s) => s.backToMenu);
  const exhausted = hintsTotal > 0 && hints >= hintsTotal;
  return (
    <header className="topbar">
      <strong className="brand">HVAC-Sim <span className="app-version">(v{APP_VERSION})</span></strong>
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
  const [guest, setGuest] = useState<string | null>(null);
  const signedIn = useRef(false);
  const pane = usePaneWidth();

  // Frame the right piece of equipment whenever a new job starts.
  useEffect(() => {
    if (sessionId === null) return;
    const state = useSim.getState();
    const first = (state.unitType === 'furnace' ? F_VIEWS : contextViews(state.context))[0];
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
  if (guest === null) {
    return <div className="app">
      <GuestSignIn onSignIn={(name) => {
        if (signedIn.current) return;
        signedIn.current = true;
        setGuest(name);
        // Submit once after the guest confirms their name; React renders cannot double-count.
        void api.trackVisit(crypto.randomUUID(), APP_VERSION, 'home', name).catch(() => undefined);
      }} />
    </div>;
  }
  return (
    <div className="app">
      {inJob && <TopBar onSubmit={() => setSubmitting(true)} onDiagram={() => setDiagram((v) => !v)} />}
      <main className="stage" style={inJob ? pane.style : undefined}>
        {inJob && <Toolbox />}
        <div className="viewport" style={inJob ? { cursor: toolCursor(tool) } : undefined}>
          <Scene />
          {inJob && <HoverBar />}
          {inJob && <CursorPartLabel />}
          {inJob && <StatusBar />}
          {inJob && <ThermostatWidget />}
          {inJob && diagram && <WiringDiagram onClose={() => setDiagram(false)} />}
        </div>
        {inJob && <Splitter width={pane.width} onChange={pane.set} />}
        {inJob && <JobPanel />}
      </main>
      {(phase === 'menu' || phase === 'loading') && <Menu />}
      {phase === 'running' && submitting && <SubmitDialog onClose={() => setSubmitting(false)} />}
      {phase === 'graded' && <ResultDialog />}
      <JobLogToasts />
      <VisitsAdmin />
    </div>
  );
}
