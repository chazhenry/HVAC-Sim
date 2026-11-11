import type { ReactNode } from 'react';
import { liquidPsig, suctionPsig } from '../sim/engine';
import { draftWc, inletWc, manifoldWc } from '../sim/furnace/engine';
import type { MeterMode, MeterReading } from '../sim/instruments';
import { clampLabel, pointInfo } from '../sim/points';
import { satTempF } from '../sim/refrigerant';
import { inchesHg } from '../sim/service';
import { ServiceCart } from './ServiceCart';
import { activeClamp, activeHot, activeReading, type ManometerTap, useSim } from '../store/useSim';

const MODES: ReadonlyArray<{ id: MeterMode; label: string; furnaceOnly?: boolean }> = [
  { id: 'vac', label: 'V~' },
  { id: 'ohm', label: 'Ω' },
  { id: 'uf', label: 'µF' },
  { id: 'ua', label: 'µA', furnaceOnly: true },
];

function formatReading(r: MeterReading): { main: string; unit: string; sub: string; alert: boolean } {
  switch (r.kind) {
    case 'idle':
      return { main: '- - -', unit: '', sub: 'Place both leads', alert: false };
    case 'ol':
      return { main: 'OL', unit: 'Ω', sub: `Open circuit${r.note ? ` (${r.note})` : ''}`, alert: false };
    case 'live':
      return { main: 'LIVE', unit: '', sub: `${r.volts.toFixed(0)} V present - switch to volts!`, alert: true };
    case 'na':
      return { main: '- - -', unit: '', sub: r.note, alert: false };
    case 'value': {
      const v = r.value;
      let main: string;
      let unit: string = r.unit;
      if (r.unit === 'V' || r.unit === 'µF') main = v.toFixed(1);
      else if (r.unit === 'µA') main = v.toFixed(2);
      else if (v >= 1000) {
        main = (v / 1000).toFixed(2);
        unit = 'kΩ';
      } else main = v < 100 ? v.toFixed(2) : v.toFixed(1);
      const beep = r.unit === 'Ω' && v < 30 ? 'continuity' : '';
      return { main, unit, sub: [beep, r.note].filter(Boolean).join(' - '), alert: false };
    }
  }
}

function Multimeter(): ReactNode {
  // Re-render on every simulation tick so the reading stays live.
  useSim((s) => s.sim ?? s.furnace);
  const mode = useSim((s) => s.meterMode);
  const leads = useSim((s) => s.leads);
  const isFurnace = useSim((s) => s.unitType === 'furnace');
  const setMode = useSim((s) => s.setMeterMode);
  const clearLeads = useSim((s) => s.clearLeads);
  const view = formatReading(activeReading(useSim.getState()));
  return (
    <div className="instrument meter">
      <header>
        <span>Multimeter</span>
        <div className="seg">
          {MODES.filter((m) => isFurnace || !m.furnaceOnly).map((m) => (
            <button key={m.id} type="button" className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </header>
      <div className={`lcd${view.alert ? ' alert' : ''}`}>
        <span className="lcd-main">{view.main}</span>
        <span className="lcd-unit">{view.unit}</span>
        <span className="lcd-sub">{view.sub}</span>
      </div>
      <div className="leads">
        <span className="lead red">{leads.red ? pointInfo(leads.red).label : 'red lead - not placed'}</span>
        <span className="lead black">{leads.black ? pointInfo(leads.black).label : 'black lead - not placed'}</span>
        <button type="button" className="link" onClick={clearLeads}>
          Lift both leads
        </button>
      </div>
    </div>
  );
}

function ClampMeter(): ReactNode {
  useSim((s) => s.sim ?? s.furnace);
  const at = useSim((s) => s.clampAt);
  const amps = at ? activeClamp(useSim.getState(), at) : 0;
  return (
    <div className="instrument meter">
      <header>
        <span>Clamp meter</span>
      </header>
      <div className="lcd">
        <span className="lcd-main">{at ? amps.toFixed(amps < 1 ? 2 : 1) : '- - -'}</span>
        <span className="lcd-unit">{at ? 'A' : ''}</span>
        <span className="lcd-sub">
          {at ? `${clampLabel(at)}${amps === 0 ? ' - no current flowing' : ''}` : 'Click a wire'}
        </span>
      </div>
      <p className="fine">A clamp reads current only. For voltage, put the multimeter leads on two terminals.</p>
    </div>
  );
}

function VoltageTester(): ReactNode {
  const at = useSim((s) => s.ncvAt);
  const hot = useSim((s) => s.ncvAt !== null && activeHot(s, s.ncvAt));
  return (
    <div className="instrument">
      <header>
        <span>Voltage tester</span>
      </header>
      <div className={`ncv${hot ? ' hot' : ''}`}>
        <span className="lamp" />
        <span>{at === null ? 'Click a terminal' : `${pointInfo(at).label}: ${hot ? 'HOT' : 'no voltage detected'}`}</span>
      </div>
    </div>
  );
}

function Dial(props: { value: number; max: number; color: string; label: string }): ReactNode {
  const { value, max, color, label } = props;
  const frac = Math.min(1, Math.max(0, value / max));
  const angle = -135 + frac * 270;
  const ticks = Array.from({ length: 11 }, (_, i) => -135 + i * 27);
  return (
    <svg viewBox="0 0 120 120" className="dial" role="img" aria-label={`${label} ${value.toFixed(0)} psig`}>
      <circle cx="60" cy="60" r="56" fill="#f4f1e8" stroke={color} strokeWidth="6" />
      {ticks.map((a, i) => (
        <g key={a} transform={`rotate(${a} 60 60)`}>
          <line x1="60" y1="12" x2="60" y2={i % 5 === 0 ? 24 : 19} stroke="#222" strokeWidth={i % 5 === 0 ? 2 : 1} />
        </g>
      ))}
      <text x="22" y="100" fontSize="8" fill="#333">0</text>
      <text x="60" y="34" fontSize="8" fill="#333" textAnchor="middle">{max / 2}</text>
      <text x="98" y="100" fontSize="8" fill="#333" textAnchor="end">{max}</text>
      <text x="60" y="88" fontSize="8" fill={color} textAnchor="middle" fontWeight="700">{label}</text>
      <g transform={`rotate(${angle} 60 60)`} style={{ transition: 'transform 120ms linear' }}>
        <line x1="60" y1="66" x2="60" y2="18" stroke="#c0271d" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <circle cx="60" cy="60" r="4.5" fill="#222" />
    </svg>
  );
}

const fmt = (x: number | null, unit: string): string => (x === null ? '- -' : `${x.toFixed(1)} ${unit}`);

function Gauges(): ReactNode {
  const sim = useSim((s) => s.sim);
  const gauges = useSim((s) => s.gauges);
  const clamps = useSim((s) => s.tempClamps);
  if (!sim) return null;
  // With the charge out, pressure no longer follows the P-T chart.
  const saturated = sim.service.staticPsig === null;
  const pressure = (psig: number): string =>
    psig < -0.05 ? `${inchesHg(psig).toFixed(1)} in. Hg vac` : `${psig.toFixed(0)} psig`;

  const low = gauges.low ? suctionPsig(sim) : 0;
  const high = gauges.high ? liquidPsig(sim) : 0;
  const suctionLine = clamps.suction ? sim.thermo.suctionLineF : null;
  const liquidLine = clamps.liquid ? sim.thermo.liquidLineF : null;
  const superheat = gauges.low && saturated && suctionLine !== null ? suctionLine - satTempF(low) : null;
  const subcool = gauges.high && saturated && liquidLine !== null ? satTempF(high) - liquidLine : null;

  return (
    <div className="instrument gauges">
      <header>
        <span>Manifold - R-410A</span>
      </header>
      <div className="dials">
        <div>
          <Dial value={low} max={350} color="#1f5fbf" label="LOW" />
          <div className="readout">{gauges.low ? pressure(low) : 'not connected'}</div>
          <div className="readout dim">{gauges.low && saturated ? `sat ${satTempF(low).toFixed(0)} °F` : ' '}</div>
        </div>
        <div>
          <Dial value={high} max={800} color="#c62828" label="HIGH" />
          <div className="readout">{gauges.high ? pressure(high) : 'not connected'}</div>
          <div className="readout dim">{gauges.high && saturated ? `sat ${satTempF(high).toFixed(0)} °F` : ' '}</div>
        </div>
      </div>
      <dl className="kv">
        <dt>Suction line</dt>
        <dd>{fmt(suctionLine, '°F')}</dd>
        <dt>Liquid line</dt>
        <dd>{fmt(liquidLine, '°F')}</dd>
        <dt>Superheat</dt>
        <dd className="strong">{fmt(superheat, '°F')}</dd>
        <dt>Subcooling</dt>
        <dd className="strong">{fmt(subcool, '°F')}</dd>
      </dl>
      <ServiceCart />
    </div>
  );
}

const TAP_NAME: Record<ManometerTap, string> = {
  draft: 'Pressure switch tap (draft)',
  inlet: 'Gas valve inlet',
  manifold: 'Gas valve manifold',
};

function Manometer(): ReactNode {
  const furnace = useSim((s) => s.furnace);
  const at = useSim((s) => s.manoAt);
  if (!furnace) return null;
  const value = at === 'draft' ? draftWc(furnace) : at === 'inlet' ? inletWc(furnace) : at === 'manifold' ? manifoldWc(furnace) : 0;
  return (
    <div className="instrument meter">
      <header>
        <span>Manometer</span>
      </header>
      <div className="lcd">
        <span className="lcd-main">{at ? value.toFixed(2) : '- - -'}</span>
        <span className="lcd-unit">{at ? 'in. w.c.' : ''}</span>
        <span className="lcd-sub">{at ? TAP_NAME[at] : 'Click a pressure tap'}</span>
      </div>
    </div>
  );
}

function TempProbes(): ReactNode {
  const furnace = useSim((s) => s.furnace);
  const probes = useSim((s) => s.probes);
  if (!furnace) return null;
  const supply = probes.supply ? furnace.hxF : null;
  const ret = probes.return ? furnace.env.indoorF : null;
  return (
    <div className="instrument">
      <header>
        <span>Temperature probes</span>
      </header>
      <dl className="kv">
        <dt>Supply air</dt>
        <dd>{fmt(supply, '°F')}</dd>
        <dt>Return air</dt>
        <dd>{fmt(ret, '°F')}</dd>
        <dt>Temperature rise</dt>
        <dd className="strong">{fmt(supply !== null && ret !== null ? supply - ret : null, '°F')}</dd>
      </dl>
      <p className="fine">Nameplate rise is on the burner door.</p>
    </div>
  );
}

export function Instruments(): ReactNode {
  const tool = useSim((s) => s.tool);
  const hasLead = useSim((s) => s.leads.red !== null || s.leads.black !== null);
  const clampAt = useSim((s) => s.clampAt);
  const ncvAt = useSim((s) => s.ncvAt);
  const anyGauge = useSim((s) => s.gauges.low || s.gauges.high || s.tempClamps.suction || s.tempClamps.liquid);
  const manoAt = useSim((s) => s.manoAt);
  const anyProbe = useSim((s) => s.probes.supply || s.probes.return);
  const showMeter = tool === 'multimeter' || hasLead;
  const showClamp = tool === 'clamp' || clampAt !== null;
  const showNcv = tool === 'ncv' || ncvAt !== null;
  const showGauges = tool === 'gauges' || tool === 'tempclamp' || anyGauge;
  const showMano = tool === 'manometer' || manoAt !== null;
  const showProbes = tool === 'thermo' || anyProbe;
  if (!showMeter && !showClamp && !showNcv && !showGauges && !showMano && !showProbes) {
    return <p className="empty">Pick up an instrument from the tool bag to see its readout here.</p>;
  }
  return (
    <>
      {showMeter && <Multimeter />}
      {showClamp && <ClampMeter />}
      {showNcv && <VoltageTester />}
      {showGauges && <Gauges />}
      {showMano && <Manometer />}
      {showProbes && <TempProbes />}
    </>
  );
}
