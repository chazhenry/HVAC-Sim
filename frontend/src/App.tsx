import { type ReactNode, useEffect, useState } from 'react';
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
import { Toolbox, ToolsButton, ToolSheet } from './ui/Toolbox';
import { effectiveLayout, useLayout } from './store/useLayout';
import {
  DrawerEdge, FirstRunPrompt, JobButton, JobDrawer, LayoutPanel, MicButton, OverflowMenu, PinnedThermostat, ThermostatControl, ViewsControl,
} from './ui/LayoutControls';
import { useCoarsePointer, useJobViews, useLayoutShortcuts, useWindowWidth } from './ui/layoutHooks';
import { toolCursor } from './ui/toolIcons';
import { HeldMeter } from './ui/HeldMeter';
import { isMeterTool } from './ui/meterTools';
import { WiringDiagram } from './ui/WiringDiagram';
import { VisitsAdmin } from './ui/VisitsAdmin';
import { SignIn } from './ui/SignIn';
import { AccountControls } from './ui/AccountControls';
import { useAuth } from './store/useAuth';
import { logSignIn } from './store/visitLog';
import { unlockAudio } from './audio/tones';
import { CursorPartLabel } from './ui/CursorPartLabel';
import { IdentifyLabel } from './ui/IdentifyLabel';
import { APP_VERSION } from './version';

const TICK_SECONDS = 0.1;
/** Where text may still be selected on the job screen. */
const SELECTABLE = 'input, textarea, [contenteditable="true"], .chat-stream';

function TopBar({ onSubmit, onDiagram, toolsFloating, jobFloating }: {
  onSubmit: () => void; onDiagram: () => void; toolsFloating: boolean; jobFloating: boolean;
}): ReactNode {
  const hints = useSim((s) => s.hints.length);
  const hintsTotal = useSim((s) => s.hintsTotal);
  const requestHint = useSim((s) => s.requestHint);
  const back = useSim((s) => s.backToMenu);
  const thermostatFloating = useLayout((s) => s.config.thermostat === 'floating');
  // With the view buttons pinned there is room for every action; otherwise rarer ones go under "⋯".
  const roomy = useLayout((s) => s.config.views === 'pinned');
  const exhausted = hintsTotal > 0 && hints >= hintsTotal;
  return (
    <header className="topbar">
      <strong className="brand">HVAC-Sim <span className="app-version">v{APP_VERSION}</span></strong>
      {toolsFloating && <ToolsButton />}
      <ViewsControl />
      {thermostatFloating && <ThermostatControl />}
      <div className="spacer" />
      <button type="button" className="ghost" onClick={onDiagram}>
        Wiring diagram
      </button>
      <button type="button" className="ghost" onClick={() => void requestHint()} disabled={exhausted}>
        {exhausted ? 'No hints left' : `Hint (−5 pts)${hints ? ` · ${hints} used` : ''}`}
      </button>
      {jobFloating && <JobButton />}
      {roomy && (
        <button type="button" className="ghost" onClick={back}>
          Abandon job
        </button>
      )}
      <button type="button" className="primary" onClick={onSubmit}>
        Complete job
      </button>
      {roomy ? <AccountControls compact /> : <OverflowMenu onAbandon={back} />}
      {/* Settings is a gear only, in every layout; the microphone stays the right-most item. */}
      <button type="button" className="ghost icon-button settings-button" aria-label="Settings" title="Settings: layout, display and audio"
        onClick={() => useLayout.getState().open('settings')}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          <path d="m10 3-.5 2-1.7 1-2-.6-2 3.4 1.5 1.4v2l-1.5 1.4 2 3.4 2-.6 1.7 1 .5 2h4l.5-2 1.7-1 2 .6 2-3.4-1.5-1.4v-2l1.5-1.4-2-3.4-2 .6-1.7-1L14 3Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <MicButton />
    </header>
  );
}

function HoverBar(): ReactNode {
  const hover = useSim((s) => s.hover);
  const touch = useCoarsePointer();
  return (
    <div className="hoverbar" aria-hidden={hover === null}>
      {hover ?? (touch ? 'Hold a finger to identify a part · drag to orbit · pinch to zoom' : 'Drag to orbit · scroll to zoom · right-drag to pan')}
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
  const user = useAuth((state) => state.user);
  const pane = usePaneWidth();
  // Right mouse button held on the 3D view pans the camera: show the four-arrow move cursor meanwhile.
  const [panning, setPanning] = useState(false);
  useEffect(() => {
    if (!panning) return;
    const stop = (event: PointerEvent): void => { if ((event.buttons & 2) === 0) setPanning(false); };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, [panning]);
  // A meter in hand is drawn under the mouse (HeldMeter), so the native cursor is hidden.
  const viewportCursor = panning ? 'move' : isMeterTool(tool) ? 'none' : toolCursor(tool);
  const config = useLayout((s) => s.config);
  const windowWidth = useWindowWidth();
  const views = useJobViews();
  // Pinned columns that would squeeze the 3D view float instead (see effectiveLayout).
  const placed = effectiveLayout(config, windowWidth, pane.width ?? (windowWidth <= 1100 ? 290 : 340));
  const toolsPinned = placed.toolBag === 'pinned';
  const jobPinned = placed.jobPanel === 'pinned';

  // Leaving the job screen closes any open sheet, menu or drawer.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'graded') {
      useLayout.getState().open(null);
      useLayout.getState().setDrawer(false);
    }
  }, [phase]);

  // Frame the right piece of equipment whenever a new job starts.
  useEffect(() => {
    if (sessionId === null) return;
    const state = useSim.getState();
    const first = (state.unitType === 'furnace' ? F_VIEWS : contextViews(state.context))[0];
    if (first) useView.getState().go(first);
  }, [sessionId]);

  useEffect(() => {
    if (!user) {
      useSim.getState().backToMenu();
      return;
    }
    void loadCatalog();
    logSignIn();
  }, [loadCatalog, user]);

  useEffect(() => {
    const id = window.setInterval(() => tick(TICK_SECONDS), TICK_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  useEffect(() => {
    if (phase !== 'running') setSubmitting(false);
  }, [phase]);

  const inJob = phase === 'running' || phase === 'graded';
  useLayoutShortcuts(inJob, views);

  // Browsers only allow sound after a tap or click: unlock it on the first one.
  useEffect(() => {
    const unlock = (): void => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // On the job screen a long press must never select text or open the browser's menu
  // ("Explain with Google", Look Up, Copy). Text boxes and the tutor's replies stay selectable.
  useEffect(() => {
    if (!inJob) return;
    const blocked = (event: Event): void => {
      if (!(event.target instanceof Element) || !event.target.closest(SELECTABLE)) event.preventDefault();
    };
    document.addEventListener('selectstart', blocked);
    document.addEventListener('contextmenu', blocked);
    return () => {
      document.removeEventListener('selectstart', blocked);
      document.removeEventListener('contextmenu', blocked);
    };
  }, [inJob]);
  if (user === null) return <div className="app"><SignIn /></div>;
  return (
    <div className={`app${config.largeTargets ? ' large-targets' : ''}${inJob ? ' job-screen' : ''}`}>
      {inJob && <TopBar onSubmit={() => setSubmitting(true)} onDiagram={() => setDiagram((v) => !v)}
        toolsFloating={!toolsPinned} jobFloating={!jobPinned} />}
      <main className="stage" style={inJob && jobPinned ? pane.style : undefined}>
        {inJob && toolsPinned && <Toolbox />}
        <div className={`viewport${inJob && !panning && isMeterTool(tool) ? ' meter-pointer' : ''}`} style={inJob ? { cursor: viewportCursor } : undefined}
          onPointerDown={(event) => { if (event.button === 2) setPanning(true); }}>
          <Scene />
          {inJob && <HoverBar />}
          {inJob && <CursorPartLabel />}
          {inJob && <IdentifyLabel />}
          {inJob && <HeldMeter />}
          {inJob && <StatusBar />}
          {inJob && config.thermostat === 'pinned' && <PinnedThermostat><ThermostatWidget /></PinnedThermostat>}
          {inJob && !jobPinned && <DrawerEdge />}
          {inJob && diagram && <WiringDiagram onClose={() => setDiagram(false)} />}
        </div>
        {inJob && jobPinned && <Splitter width={pane.width} onChange={pane.set} />}
        {inJob && jobPinned && <JobPanel pinned />}
        {inJob && !toolsPinned && <ToolSheet />}
        {inJob && !jobPinned && <JobDrawer><JobPanel /></JobDrawer>}
      </main>
      {inJob && <LayoutPanel />}
      {inJob && <FirstRunPrompt />}
      {(phase === 'menu' || phase === 'loading') && <Menu />}
      {phase === 'running' && submitting && <SubmitDialog onClose={() => setSubmitting(false)} />}
      {phase === 'graded' && <ResultDialog />}
      <JobLogToasts />
      <VisitsAdmin />
    </div>
  );
}
