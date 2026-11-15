import { type ReactNode, useEffect, useMemo } from 'react';
import { liquidPsig, suctionPsig } from '../sim/engine';
import { clampLabel, pointInfo } from '../sim/points';
import { satTempF } from '../sim/refrigerant';
import { activeClamp, activeHot, activeReading, type AppState, useSim } from '../store/useSim';
import { MeterCursor } from './ClampMeterCursor';
import { CLAMP } from './meterScale';
import { useCoarsePointer } from './layoutHooks';
import { formatReading } from './meterFormat';
import { isMeterTool, meterModes } from './meterTools';
import {
  clampDisplay, clampMeterImage, type MultimeterFace, MULTIMETER_SIZE, multimeterImage, type TempClampFace,
  TEMP_CLAMP_SIZE, tempClampImage, type TesterFace, TESTER_SIZE, testerImage,
} from './toolIcons';

function testerFace(s: AppState): TesterFace {
  return s.ncvAt === null ? { hot: null, point: '' } : { hot: activeHot(s, s.ncvAt), point: pointInfo(s.ncvAt).label };
}

/** Line temperatures, and superheat / subcooling where the gauges make them meaningful (as on the INSTRUMENTS panel). */
function tempClampFace(s: AppState): TempClampFace {
  const sim = s.sim;
  if (!sim) return { suction: null, liquid: null, superheat: null, subcool: null, heating: false };
  const round = (value: number | null): number | null => (value === null ? null : Math.round(value * 10) / 10);
  const suction = s.tempClamps.suction ? sim.thermo.suctionLineF : null;
  const liquid = s.tempClamps.liquid ? sim.thermo.liquidLineF : null;
  const heating = sim.heatPump !== null && sim.controls.mode === 'heat';
  const saturated = sim.service.staticPsig === null;
  const superheat = !heating && s.gauges.low && saturated && suction !== null ? suction - satTempF(suctionPsig(sim)) : null;
  const subcool = s.gauges.high && saturated && liquid !== null ? satTempF(liquidPsig(sim)) - liquid : null;
  return { suction: round(suction), liquid: round(liquid), superheat: round(superheat), subcool: round(subcool), heating };
}

/** Everything the multimeter drawing shows, as one value (so it redraws only when the display changes). */
function multimeterFace(s: AppState): MultimeterFace {
  const view = formatReading(activeReading(s));
  const modes = meterModes(s);
  const { red, black } = s.leads;
  return {
    main: view.main, unit: view.unit, sub: view.sub, alert: view.alert,
    modes: modes.map((m) => m.label),
    mode: Math.max(0, modes.findIndex((m) => m.id === s.meterMode)),
    // Same rule as the store's probe(): fill an empty lead first, else alternate.
    next: red === null ? 'red' : black === null ? 'black' : s.nextLead,
    redPlaced: red !== null,
    blackPlaced: black !== null,
  };
}

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** A right-click that moves less than this (and is released this quickly) turns the dial; anything more is a pan. */
const RIGHT_CLICK_SLOP_PX = 5;
const RIGHT_CLICK_MS = 450;

/**
 * Turning the multimeter's range dial with a mouse and keyboard, where left clicks place the probes:
 * M / Shift+M, Shift + mouse wheel, or a quick right-click on the 3D view (a right-drag still pans).
 */
function useMultimeterDial(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const turn = (step: 1 | -1): void => {
      const state = useSim.getState();
      const modes = meterModes(state);
      const at = Math.max(0, modes.findIndex((m) => m.id === state.meterMode));
      const next = modes[(at + step + modes.length) % modes.length];
      if (next) state.setMeterMode(next.id);
    };
    const key = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'm' || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      event.preventDefault();
      turn(event.shiftKey ? -1 : 1);
    };
    const wheel = (event: WheelEvent): void => {
      if (!event.shiftKey || event.ctrlKey || !(event.target instanceof HTMLCanvasElement)) return;
      // Shift + wheel turns the dial instead of zooming the camera.
      event.preventDefault();
      event.stopPropagation();
      turn(event.deltaY > 0 || event.deltaX > 0 ? 1 : -1);
    };
    let right: { x: number; y: number; time: number } | null = null;
    const down = (event: PointerEvent): void => {
      right = event.button === 2 && event.pointerType === 'mouse' && event.target instanceof HTMLCanvasElement
        ? { x: event.clientX, y: event.clientY, time: performance.now() } : null;
    };
    const up = (event: PointerEvent): void => {
      if (event.button !== 2 || !right) return;
      const still = Math.hypot(event.clientX - right.x, event.clientY - right.y) < RIGHT_CLICK_SLOP_PX;
      const quick = performance.now() - right.time < RIGHT_CLICK_MS;
      right = null;
      if (still && quick) turn(1);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('wheel', wheel, { passive: false, capture: true });
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('wheel', wheel, { capture: true });
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
    };
  }, [active]);
}

/**
 * The meter in hand (clamp meter or multimeter), drawn with its live display. With a mouse it follows
 * the pointer (MeterCursor); on a touch screen, which has no pointer, it sits in the top-right corner
 * of the 3D view.
 */
export function HeldMeter(): ReactNode {
  const tool = useSim((s) => s.tool);
  const touch = useCoarsePointer();
  // String selectors: re-render only when what the meter shows changes.
  const clampKey = useSim((s) => {
    if (s.tool !== 'clamp') return '';
    const amps = s.clampAt ? activeClamp(s, s.clampAt) : 0;
    const reading = s.clampAt ? clampDisplay(amps) : '';
    const caption = !s.clampAt ? 'Click a wire' : `${clampLabel(s.clampAt)}${amps === 0 ? ' - no current' : ''}`;
    return JSON.stringify([reading, s.clampRejected, caption]);
  });
  const meterKey = useSim((s) => (s.tool === 'multimeter' ? JSON.stringify(multimeterFace(s)) : ''));
  const testerKey = useSim((s) => (s.tool === 'ncv' ? JSON.stringify(testerFace(s)) : ''));
  const tempKey = useSim((s) => (s.tool === 'tempclamp' ? JSON.stringify(tempClampFace(s)) : ''));
  useMultimeterDial(tool === 'multimeter');

  const drawing = useMemo(() => {
    if (clampKey) {
      const [reading, rejected, caption] = JSON.parse(clampKey) as [string, boolean, string];
      return { src: clampMeterImage(reading || null, rejected, caption), size: CLAMP };
    }
    if (meterKey) return { src: multimeterImage(JSON.parse(meterKey) as MultimeterFace), size: MULTIMETER_SIZE };
    if (testerKey) return { src: testerImage(JSON.parse(testerKey) as TesterFace), size: TESTER_SIZE };
    if (tempKey) return { src: tempClampImage(JSON.parse(tempKey) as TempClampFace), size: TEMP_CLAMP_SIZE };
    return null;
  }, [clampKey, meterKey, testerKey, tempKey]);

  if (!drawing || !isMeterTool(tool)) return null;
  if (touch) {
    return (
      <div className="corner-meter">
        <div className="corner-meter-face">
          <img src={drawing.src} alt="" aria-hidden="true" draggable={false}
            style={{ width: drawing.size.width * CORNER_SCALE, height: drawing.size.height * CORNER_SCALE }} />
          {tool === 'multimeter' && <DialTarget />}
        </div>
        {tool === 'multimeter' && <MultimeterTouchControls />}
      </div>
    );
  }
  return (
    <>
      <MeterCursor key={tool} tool={tool} src={drawing.src} size={drawing.size} />
      {/* The range dial as buttons, clear of the 3D model so clicking them never places a probe. */}
      {tool === 'multimeter' && <div className="meter-range-strip"><MultimeterTouchControls showHints /></div>}
    </>
  );
}

/**
 * Touch controls for the corner multimeter (no keyboard or wheel on an iPad): tap the drawn dial to
 * turn it, or pick a range directly, and lift both leads.
 */
function DialTarget(): ReactNode {
  const unitType = useSim((s) => s.unitType);
  const mode = useSim((s) => s.meterMode);
  const modes = meterModes({ unitType });
  const at = Math.max(0, modes.findIndex((m) => m.id === mode));
  const next = modes[(at + 1) % modes.length];
  // Over the drawing's rotary dial (centre 40, 98 of the 80 × 128 drawing).
  return <button type="button" className="corner-meter-dial" aria-label={`Turn the range dial to ${next?.label ?? ''}`}
    onClick={() => { if (next) useSim.getState().setMeterMode(next.id); }} />;
}

/** Range buttons and Lift leads: under the corner meter on a touch screen, in the view's corner on a PC. */
function MultimeterTouchControls({ showHints = false }: { showHints?: boolean }): ReactNode {
  const unitType = useSim((s) => s.unitType);
  const mode = useSim((s) => s.meterMode);
  const anyLead = useSim((s) => s.leads.red !== null || s.leads.black !== null);
  const modes = meterModes({ unitType });
  const { setMeterMode, clearLeads } = useSim.getState();
  return (
    <>
      <div className="corner-meter-controls">
        <div className="seg corner-meter-modes" role="group" aria-label="Multimeter range">
          {modes.map((m) => (
            <button key={m.id} type="button" className={m.id === mode ? 'on' : ''} aria-pressed={m.id === mode}
              title={showHints ? `${m.label} range · also: M / Shift+M, Shift+wheel, or right-click the 3D view` : undefined}
              onClick={() => setMeterMode(m.id)}>{m.label}</button>
          ))}
        </div>
        <button type="button" className="corner-meter-lift" disabled={!anyLead} onClick={clearLeads}
          title={showHints ? 'Take both leads off the terminals' : undefined}>Lift leads</button>
      </div>
    </>
  );
}

/** On a touch screen the corner meter is drawn this much larger than the 76–80 px drawing. */
const CORNER_SCALE = 1.9;
