import { type ReactNode, useState } from 'react';
import { TSTAT_MAX_F, TSTAT_MIN_F, type TstatMode, type TstatStyle, useSim } from '../store/useSim';

/**
 * The wall thermostat, shown in the corner of the 3D view. Two faces over the
 * same state: a common digital wall thermostat and a round smart thermostat.
 */

interface FaceProps {
  mode: TstatMode;
  setpointF: number;
  roomF: number;
  calling: boolean;
}

const SPAN = TSTAT_MAX_F - TSTAT_MIN_F;
const frac = (f: number): number => (Math.min(TSTAT_MAX_F, Math.max(TSTAT_MIN_F, f)) - TSTAT_MIN_F) / SPAN;

/** Point at `deg` clockwise from straight up, `r` from the centre of a 200-unit face. */
const polar = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [100 + r * Math.sin(a), 100 - r * Math.cos(a)];
};

const ray = (deg: number, r1: number, r2: number): { x1: number; y1: number; x2: number; y2: number } => {
  const [x1, y1] = polar(deg, r1);
  const [x2, y2] = polar(deg, r2);
  return { x1, y1, x2, y2 };
};

// ---------- smart thermostat ----------

const smartAngle = (f: number): number => -150 + frac(f) * 300;
const SMART_TICKS = Array.from({ length: SPAN * 2 + 1 }, (_, i) => TSTAT_MIN_F + i / 2);

function SmartFace({ mode, setpointF, roomF, calling }: FaceProps): ReactNode {
  const off = mode === 'off';
  const screen = calling ? (mode === 'heat' ? '#e2531c' : '#1a43e6') : '#15171b';
  const lo = Math.min(setpointF, roomF);
  const hi = Math.max(setpointF, roomF);
  const label = off ? 'OFF' : calling ? (mode === 'heat' ? 'HEATING' : 'COOLING') : mode === 'heat' ? 'HEAT SET TO' : 'COOL SET TO';
  const saving = !off && (mode === 'cool' ? setpointF >= 76 : setpointF <= 68);
  const [rx, ry] = polar(smartAngle(roomF), 77);
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={`Smart thermostat: ${label} ${off ? '' : setpointF}, room ${roomF}`}>
      <defs>
        <linearGradient id="tstat-gloss" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a3d42" />
          <stop offset="0.45" stopColor="#0b0c0e" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
      </defs>
      <circle cx={100} cy={100} r={98} fill="#ebe8de" stroke="#c9c5b8" strokeWidth={1.5} />
      <circle cx={100} cy={100} r={91} fill="url(#tstat-gloss)" />
      <circle cx={100} cy={100} r={66} fill={screen} />
      <g stroke="#fff" strokeLinecap="round">
        {SMART_TICKS.map((f) => (
          <line
            key={f}
            {...ray(smartAngle(f), 53, 63)}
            strokeWidth={0.9}
            strokeOpacity={!off && f >= lo && f <= hi ? 0.95 : 0.3}
          />
        ))}
        {!off && <line {...ray(smartAngle(setpointF), 47, 64)} strokeWidth={2.4} />}
        <line {...ray(smartAngle(roomF), 51, 64)} strokeWidth={1.6} />
      </g>
      <g fill="#fff" textAnchor="middle" fontFamily="'Segoe UI', system-ui, sans-serif">
        <text x={100} y={80} fontSize={10} letterSpacing={0.6} fillOpacity={0.92}>
          {label}
        </text>
        <text x={100} y={123} fontSize={46} fontWeight={600}>
          {off ? roomF.toFixed(0) : setpointF.toFixed(0)}
        </text>
        {!off && roomF !== setpointF && (
          <text x={rx} y={ry + 3.5} fontSize={10} fontWeight={600}>
            {roomF.toFixed(0)}
          </text>
        )}
      </g>
      {saving && <path d="M92 151 C91 141 99 136 110 136 C111 147 104 153 92 151 Z" fill="#3fd13f" />}
    </svg>
  );
}

// ---------- digital wall thermostat ----------

const LCD_INK = '#1c2a10';

function DigitalFace({ mode, setpointF, roomF, calling, onStep }: FaceProps & { onStep?: (delta: number) => void }): ReactNode {
  const off = mode === 'off';
  const name = mode === 'heat' ? 'Heat' : 'Cool';
  const arrow = (y: number, delta: number): ReactNode => (
    <g
      {...(onStep ? { onClick: () => onStep(delta), style: { cursor: 'pointer' }, role: 'button' } : {})}
      aria-label={delta > 0 ? 'Raise setpoint' : 'Lower setpoint'}
    >
      <ellipse cx={169} cy={y} rx={15} ry={12} fill="url(#tstat-key)" stroke="#b9b6ab" />
      <path d={delta > 0 ? `M162 ${y + 4} L169 ${y - 5} L176 ${y + 4} Z` : `M162 ${y - 4} L169 ${y + 5} L176 ${y - 4} Z`} fill="#6d6b63" />
    </g>
  );
  return (
    <svg viewBox="0 0 200 150" role="img" aria-label={`Digital thermostat: system ${mode}, set ${setpointF}, inside ${roomF}`}>
      <defs>
        <linearGradient id="tstat-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfaf6" />
          <stop offset="1" stopColor="#dedcd3" />
        </linearGradient>
        <linearGradient id="tstat-key" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1efe8" />
          <stop offset="1" stopColor="#c9c6bb" />
        </linearGradient>
      </defs>
      <path
        d="M24 4 H176 Q194 6 196 26 Q200 75 196 124 Q194 144 176 146 H24 Q6 144 4 124 Q0 75 4 26 Q6 6 24 4 Z"
        fill="url(#tstat-body)"
        stroke="#bdbab0"
        strokeWidth={1.5}
      />
      <rect x={20} y={20} width={122} height={88} rx={4} fill="#b9e24c" stroke="#7d9a2e" strokeWidth={1.5} />
      <g fill={LCD_INK} fontFamily="'Segoe UI', system-ui, sans-serif">
        <text x={27} y={33} fontSize={8.5}>
          Inside
        </text>
        <text x={58} y={76} fontSize={44} fontWeight={300} textAnchor="middle" fontFamily="Consolas, 'Courier New', monospace">
          {roomF.toFixed(0)}
        </text>
        <text x={84} y={50} fontSize={10}>
          °
        </text>
        {!off && (
          <>
            <text x={136} y={33} fontSize={8.5} textAnchor="end">
              {calling ? `${name} On` : name}
            </text>
            <text x={136} y={42} fontSize={8.5} textAnchor="end">
              Setting
            </text>
            <text x={120} y={72} fontSize={22} fontWeight={300} textAnchor="middle" fontFamily="Consolas, 'Courier New', monospace">
              {setpointF.toFixed(0)}
            </text>
            <text x={134} y={58} fontSize={7}>
              °
            </text>
          </>
        )}
        <path d="M24 84 H138 M78 84 V104" stroke={LCD_INK} strokeWidth={0.8} fill="none" />
        <text x={27} y={93} fontSize={8} fontWeight={700}>
          Fan
        </text>
        <text x={74} y={102} fontSize={8} textAnchor="end">
          Auto
        </text>
        <text x={82} y={93} fontSize={8} fontWeight={700}>
          System
        </text>
        <text x={136} y={102} fontSize={8} textAnchor="end">
          {off ? 'Off' : name}
        </text>
      </g>
      {arrow(48, 1)}
      {arrow(82, -1)}
      <circle cx={70} cy={127} r={10} fill="url(#tstat-key)" stroke="#b9b6ab" />
      <circle cx={112} cy={127} r={10} fill="url(#tstat-key)" stroke="#b9b6ab" />
    </svg>
  );
}

const STYLES: ReadonlyArray<{ id: TstatStyle; label: string }> = [
  { id: 'digital', label: 'Standard thermostat' },
  { id: 'smart', label: 'Smart thermostat' },
];

function useFace(): FaceProps | null {
  const tstat = useSim((s) => s.tstat);
  const roomF = useSim((s) => (s.sim ?? s.furnace)?.env.indoorF);
  const calling = useSim((s) => (s.sim ?? s.furnace)?.controls.calling ?? false);
  return roomF === undefined ? null : { ...tstat, roomF, calling };
}

/** `onStep` makes the digital face's arrow keys live; leave it out where the whole face is one button. */
const Face = ({ style, onStep, ...face }: FaceProps & { style: TstatStyle; onStep?: (delta: number) => void }): ReactNode =>
  style === 'smart' ? <SmartFace {...face} /> : <DigitalFace {...face} {...(onStep ? { onStep } : {})} />;

// ---------- settings ----------

function ThermostatDialog({ onClose }: { onClose: () => void }): ReactNode {
  const face = useFace();
  const style = useSim((s) => s.tstatStyle);
  const setStyle = useSim((s) => s.setTstatStyle);
  const set = useSim((s) => s.setThermostat);
  const onMode: TstatMode = useSim((s) => (s.unitType === 'furnace' ? 'heat' : 'cool'));
  const outdoorF = useSim((s) => (s.sim ?? s.furnace)?.env.outdoorF);
  if (!face) return null;
  const { mode, setpointF, roomF, calling } = face;
  const status =
    mode === 'off'
      ? 'Off - the thermostat will not call.'
      : calling
        ? `Calling for ${mode === 'heat' ? 'heat' : 'cooling'}: the room is ${roomF.toFixed(0)} °F and the setpoint is ${setpointF} °F.`
        : `Satisfied - not calling. The room is ${roomF.toFixed(0)} °F; set it ${mode === 'heat' ? 'above' : 'below'} that to make it call.`;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog tstat-dialog" role="dialog" aria-label="Thermostat settings" onClick={(e) => e.stopPropagation()}>
        <h2>Thermostat</h2>
        <div className="tstat-big">
          <Face style={style} {...face} onStep={(delta) => set({ setpointF: setpointF + delta })} />
        </div>
        <div className="tstat-row">
          <span className="cart-label">Mode</span>
          <div className="seg" role="group" aria-label="Thermostat mode">
            <button type="button" className={mode === 'off' ? 'on' : ''} onClick={() => set({ mode: 'off' })}>
              Off
            </button>
            <button type="button" className={mode === onMode ? `on ${onMode}` : ''} onClick={() => set({ mode: onMode })}>
              {onMode === 'heat' ? 'Heat' : 'Cool'}
            </button>
          </div>
        </div>
        <div className="tstat-row">
          <span className="cart-label">Setpoint</span>
          <div className="tstat-step">
            <button type="button" aria-label="Lower setpoint" onClick={() => set({ setpointF: setpointF - 1 })}>
              −
            </button>
            <input
              type="range"
              aria-label="Setpoint"
              min={TSTAT_MIN_F}
              max={TSTAT_MAX_F}
              step={1}
              value={setpointF}
              onChange={(e) => set({ setpointF: Number(e.target.value) })}
            />
            <button type="button" aria-label="Raise setpoint" onClick={() => set({ setpointF: setpointF + 1 })}>
              +
            </button>
            <strong>{setpointF} °F</strong>
          </div>
        </div>
        <div className="tstat-row">
          <span className="cart-label">Style</span>
          <div className="seg" role="group" aria-label="Thermostat style">
            {STYLES.map((s) => (
              <button key={s.id} type="button" className={style === s.id ? 'on' : ''} onClick={() => setStyle(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <p className={calling ? 'tstat-status calling' : 'tstat-status'}>{status}</p>
        <p className="fine">
          Room {roomF.toFixed(0)} °F{outdoorF === undefined ? '' : ` · outdoor ${outdoorF.toFixed(0)} °F`}. The room temperature
          stays put in this trainer, so the thermostat keeps calling until you change it.
        </p>
        <div className="actions">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- corner widget ----------

export function ThermostatWidget(): ReactNode {
  const face = useFace();
  const style = useSim((s) => s.tstatStyle);
  const setStyle = useSim((s) => s.setTstatStyle);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState(false);
  if (!face) return null;
  return (
    <div className="tstat">
      <button type="button" className={`tstat-face ${style}`} title="Thermostat - click to set" onClick={() => setDialog(true)}>
        <Face style={style} {...face} />
      </button>
      <button
        type="button"
        className="tstat-chev"
        aria-label="Thermostat options"
        aria-expanded={menu}
        onClick={() => setMenu((v) => !v)}
      >
        <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true">
          <path d="M3 6 L8 11 L13 6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {menu && (
        <>
          <div className="tstat-shade" onClick={() => setMenu(false)} />
          <div className="tstat-menu" role="menu">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={style === s.id}
                onClick={() => {
                  setStyle(s.id);
                  setMenu(false);
                }}
              >
                <span className="tick">{style === s.id ? '✓' : ''}</span>
                {s.label}
              </button>
            ))}
            <hr />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                setDialog(true);
              }}
            >
              <span className="tick" />
              Set temperature and mode…
            </button>
          </div>
        </>
      )}
      {dialog && <ThermostatDialog onClose={() => setDialog(false)} />}
    </div>
  );
}
