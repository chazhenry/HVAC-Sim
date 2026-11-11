import { type ReactNode, useState } from 'react';
import type { FClampPointId, FTestPointId } from '../sim/furnace/testPoints';
import { type AnyClampId, type AnyTestPointId, clampLabel, pointInfo } from '../sim/points';
import type { ClampPointId, TestPointId } from '../sim/testPoints';
import { cabs } from '../sim/circuit';
import type { NodeId } from '../sim/electrical';
import type { FNodeId } from '../sim/furnace/electrical';
import { useSim } from '../store/useSim';

/**
 * Ladder diagrams like the one glued inside a unit's access panel. They are
 * drawn de-energised and never show live state - finding which switch is open
 * is the learner's job - but they do mark where the meter leads and clamp are.
 */

const PAPER = '#f4f1e8';
const INK = '#1d232b';
const LOW_VOLT = '#1f5fbf';

type Side = 'n' | 's' | 'e' | 'w';
type Pt = readonly [x: number, y: number, side: Side];
type Xy = readonly [x: number, y: number];

// ---------- symbols (drawn horizontally, centred on the wire they sit on) ----------

interface At {
  x: number;
  y: number;
  /** Rotate onto a vertical wire. */
  v?: boolean;
}

function Sym({ x, y, v, children }: At & { children: ReactNode }): ReactNode {
  return <g transform={`translate(${x} ${y})${v ? ' rotate(90)' : ''}`}>{children}</g>;
}

/** Hides the wire underneath a symbol. */
const Gap = ({ w }: { w: number }): ReactNode => (
  <rect x={-w / 2} y={-3} width={w} height={6} fill={PAPER} stroke="none" />
);

function Switch({ closed, ...at }: At & { closed?: boolean }): ReactNode {
  return (
    <Sym {...at}>
      <Gap w={24} />
      <line x1={-12} y1={0} x2={closed ? 11 : 9} y2={closed ? -2.5 : -9} />
      <circle cx={-12} cy={0} r={2.2} fill={PAPER} />
      <circle cx={12} cy={0} r={2.2} fill={PAPER} />
    </Sym>
  );
}

function Contact(at: At): ReactNode {
  return (
    <Sym {...at}>
      <Gap w={9} />
      <line x1={-4.5} y1={-8} x2={-4.5} y2={8} />
      <line x1={4.5} y1={-8} x2={4.5} y2={8} />
    </Sym>
  );
}

function Capacitor(at: At): ReactNode {
  return (
    <Sym {...at}>
      <Gap w={8} />
      <line x1={-4} y1={-8} x2={-4} y2={8} />
      <path d="M6 -8 Q0 0 6 8" />
    </Sym>
  );
}

function Winding({ turns = 4, flip, ...at }: At & { turns?: number; flip?: boolean }): ReactNode {
  const arc = `a5 5 0 0 ${flip ? 0 : 1} 10 0`;
  return (
    <Sym {...at}>
      <Gap w={turns * 10} />
      <path d={`M${-turns * 5} 0 ${arc.repeat(turns)}`} />
    </Sym>
  );
}

function Load({ text, ...at }: At & { text: string }): ReactNode {
  return (
    <Sym {...at}>
      <circle r={12} fill={PAPER} />
      <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="currentColor" stroke="none">
        {text}
      </text>
    </Sym>
  );
}

function Fuse(at: At): ReactNode {
  return (
    <Sym {...at}>
      <rect x={-11} y={-4.5} width={22} height={9} fill={PAPER} />
      <line x1={-11} y1={0} x2={11} y2={0} />
    </Sym>
  );
}

function Resistor(at: At): ReactNode {
  return (
    <Sym {...at}>
      <Gap w={36} />
      <polyline points="-18,0 -15,-5 -9,5 -3,-5 3,5 9,-5 15,5 18,0" />
    </Sym>
  );
}

/** A control-board input or output drawn as a labelled box. */
function Box({ text, w = 58, ...at }: At & { text: string; w?: number }): ReactNode {
  return (
    <Sym {...at}>
      <rect x={-w / 2} y={-8} width={w} height={16} fill={PAPER} />
      <text y={3} textAnchor="middle" fontSize={8.5} fill="currentColor" stroke="none">
        {text}
      </text>
    </Sym>
  );
}

function Ground({ x, y }: { x: number; y: number }): ReactNode {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={0} x2={0} y2={8} />
      <line x1={-7} y1={8} x2={7} y2={8} />
      <line x1={-4.5} y1={11} x2={4.5} y2={11} />
      <line x1={-2} y1={14} x2={2} y2={14} />
    </g>
  );
}

const Dot = ({ x, y }: { x: number; y: number }): ReactNode => (
  <circle cx={x} cy={y} r={2.4} fill="currentColor" stroke="none" />
);

function T(props: { x: number; y: number; children: string; anchor?: 'start' | 'middle' | 'end'; size?: number; bold?: boolean }): ReactNode {
  const { x, y, children, anchor = 'middle', size = 9, bold } = props;
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={bold ? 700 : 400} fill={INK} stroke="none">
      {children}
    </text>
  );
}

const Wires = ({ color, children }: { color: string; children: ReactNode }): ReactNode => (
  <g style={{ color }} stroke="currentColor" strokeWidth={1.6} fill="none" strokeLinecap="round">
    {children}
  </g>
);

const Link = ({ d }: { d: string }): ReactNode => (
  <path d={d} stroke={INK} strokeWidth={1} strokeDasharray="4 3" fill="none" />
);

// ---------- terminals, meter leads and clamp ----------

function Markers(props: { points: Record<string, Pt>; clamps: Record<string, Xy> }): ReactNode {
  const red = useSim((s) => s.leads.red);
  const black = useSim((s) => s.leads.black);
  const clampAt = useSim((s) => s.clampAt);
  const clampXy = clampAt !== null ? props.clamps[clampAt] : undefined;
  return (
    <g>
      {Object.entries(props.points).map(([id, [x, y, side]]) => {
        const info = pointInfo(id as AnyTestPointId);
        const lead = red === id ? '#d5261c' : black === id ? '#111' : null;
        const tx = side === 'w' ? x - 9 : side === 'e' ? x + 9 : x;
        const ty = side === 'n' ? y - 8 : side === 's' ? y + 15 : y + 3;
        return (
          <g key={id}>
            <title>{info.label}</title>
            {lead && <circle cx={x} cy={y} r={7.5} fill={lead} stroke="#fff" strokeWidth={1.8} />}
            {!lead && <circle cx={x} cy={y} r={3.4} fill={PAPER} stroke={INK} strokeWidth={1.5} />}
            <text
              x={tx}
              y={ty}
              textAnchor={side === 'w' ? 'end' : side === 'e' ? 'start' : 'middle'}
              fontSize={8.5}
              fontWeight={700}
              fill={lead ?? INK}
            >
              {info.short}
            </text>
          </g>
        );
      })}
      {clampAt !== null && clampXy && (
        <g>
          <title>{`Clamp meter: ${clampLabel(clampAt as AnyClampId)}`}</title>
          <circle cx={clampXy[0]} cy={clampXy[1]} r={8} fill="none" stroke="#e08a00" strokeWidth={3.2} />
        </g>
      )}
    </g>
  );
}

// ---------- trace power ----------

/** Volts to ground above which a conductor counts as energised. */
const HOT_VOLTS = 5;

/** Wire runs belonging to one electrical node, lit when that node is energised. */
function Trace<N extends string>(props: { runs: Partial<Record<N, string>>; hot: (node: N) => boolean }): ReactNode {
  return (
    <g stroke="#ff8a00" strokeOpacity={0.6} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {(Object.entries(props.runs) as Array<[N, string]>).map(([node, d]) =>
        props.hot(node) ? <path key={node} d={d} /> : null,
      )}
    </g>
  );
}

const C_RUNS: Partial<Record<NodeId, string>> = {
  L1_LINE: 'M50 34 V51',
  L2_LINE: 'M470 34 V51',
  L1_LOAD: 'M50 73 V143',
  L2_LOAD: 'M470 73 V143',
  T1: 'M50 153 V325 H210 M50 205 H118 M160 325 V290 H210',
  COMP_INT: 'M142 205 H210 M160 205 V240 H210',
  T2: 'M470 153 V325 H250 M250 205 H470 M392 240 H410 V290 H392 M410 265 H470',
  COMP_S: 'M250 240 H382',
  FAN_BRN: 'M250 290 H382',
  LV_R: 'M50 410 H83',
  LV_Y: 'M107 410 H173',
  LV_SW: 'M197 410 H263',
  COIL_Y: 'M287 410 H363',
};

const F_RUNS: Partial<Record<FNodeId, string>> = {
  L1: 'M50 34 V43',
  L1_SW: 'M50 67 V109',
  L1_BD: 'M50 133 V365 H230 M50 205 H95 M50 245 H95 M50 285 H95',
  IND: 'M105 205 H258',
  IGN: 'M105 245 H252',
  BLW: 'M105 285 H250 M200 285 V317 H250',
  BLW_CAP: 'M290 317 H363',
  SEC: 'M230 385 H80 V515 H168 M80 435 H109 M80 475 H168',
  R: 'M131 435 H203',
  W: 'M227 435 H331',
  PS_IN: 'M192 475 H331',
  LIM_IN: 'M192 515 H331 M280 515 V555 H300',
  MV: 'M310 555 H376',
};

function CondenserTrace(): ReactNode {
  const v = useSim((s) => s.sim?.solution.v);
  return v ? <Trace runs={C_RUNS} hot={(n) => cabs(v[n]) > HOT_VOLTS} /> : null;
}

function FurnaceTrace(): ReactNode {
  const v = useSim((s) => s.furnace?.solution.v);
  return v ? <Trace runs={F_RUNS} hot={(n) => cabs(v[n]) > HOT_VOLTS} /> : null;
}

// ---------- condenser ----------

const C_POINTS: Record<TestPointId, Pt> = {
  DISC_L1_LINE: [50, 34, 'w'],
  DISC_L1_LOAD: [50, 92, 'w'],
  CONT_L1: [50, 122, 'w'],
  CONT_T1: [50, 174, 'w'],
  DISC_L2_LINE: [470, 34, 'e'],
  DISC_L2_LOAD: [470, 92, 'e'],
  CONT_L2: [470, 122, 'e'],
  CONT_T2: [470, 174, 'e'],
  COMP_C: [95, 205, 'n'],
  COMP_R: [300, 205, 'n'],
  COMP_S: [300, 240, 'n'],
  CAP_HERM: [362, 240, 'n'],
  CAP_C: [432, 265, 'n'],
  CAP_FAN: [362, 290, 's'],
  FAN_BRN: [300, 290, 'n'],
  FAN_PUR: [300, 325, 's'],
  FAN_BLK: [95, 325, 's'],
  LV_Y: [140, 410, 's'],
  LV_SW: [230, 410, 's'],
  COIL_A: [320, 410, 's'],
  COIL_B: [430, 410, 's'],
  DISC_GND: [200, 452, 'w'],
  GND_LUG: [320, 452, 'e'],
};

const C_CLAMPS: Record<ClampPointId, Xy> = {
  W_L1: [50, 107],
  W_L2: [470, 107],
  W_COMP_C: [72, 205],
  W_COMP_R: [331, 205],
  W_COMP_S: [331, 240],
  W_FAN_BLK: [72, 325],
  W_FAN_PUR: [331, 325],
  W_FAN_BRN: [331, 290],
  W_COIL: [348, 410],
};

function CondenserDiagram({ trace }: { trace: boolean }): ReactNode {
  return (
    <svg viewBox="0 0 520 480" role="img" aria-label="Condensing unit ladder wiring diagram">
      <rect width={520} height={480} fill={PAPER} />
      {trace && <CondenserTrace />}
      <T x={260} y={16} bold size={10}>
        LINE VOLTAGE - 240 V 1Ø
      </T>
      <Wires color={INK}>
        <path d="M50 34 V325 M470 34 V325" />
        <path d="M50 205 H470 M50 325 H470" />
        <path d="M160 205 V240 H410 V290 H160 V325 M410 265 H470" />
        <Dot x={160} y={205} />
        <Dot x={160} y={325} />
        <Dot x={410} y={265} />
        <Fuse x={50} y={62} v />
        <Fuse x={470} y={62} v />
        <Contact x={50} y={148} v />
        <Contact x={470} y={148} v />
        <Switch x={130} y={205} closed />
        <Winding x={230} y={205} />
        <Winding x={230} y={240} />
        <Winding x={230} y={290} />
        <Winding x={230} y={325} />
        <Capacitor x={386} y={240} />
        <Capacitor x={386} y={290} />
      </Wires>
      <Link d="M64 62 H456 M62 148 H458" />
      <Link d="M346 226 H448 V311 H346 Z" />
      <T x={260} y={56}>DISCONNECT WITH 30 A FUSES</T>
      <T x={260} y={142}>CONTACTOR CONTACTS (CC)</T>
      <T x={130} y={196}>OVERLOAD</T>
      <T x={230} y={195}>COMP RUN</T>
      <T x={230} y={231}>COMP START</T>
      <T x={230} y={281}>FAN START</T>
      <T x={230} y={316}>FAN RUN</T>
      <T x={397} y={221}>DUAL RUN CAPACITOR</T>

      <T x={260} y={376} bold size={10}>
        24 V CONTROL - from the indoor unit
      </T>
      <Wires color={LOW_VOLT}>
        <path d="M50 410 H470" />
        <Switch x={95} y={410} />
        <Switch x={185} y={410} closed />
        <Switch x={275} y={410} closed />
        <Load x={375} y={410} text="CC" />
        <circle cx={50} cy={410} r={3} fill={PAPER} />
        <circle cx={470} cy={410} r={3} fill={PAPER} />
      </Wires>
      <T x={42} y={413} anchor="end" bold>
        R
      </T>
      <T x={478} y={413} anchor="start" bold>
        C
      </T>
      <T x={95} y={395}>THERMOSTAT</T>
      <T x={185} y={398}>HIGH PRESS.</T>
      <T x={275} y={398}>LOW PRESS.</T>
      <T x={375} y={391}>CONTACTOR COIL</T>

      <Wires color="#2d7a46">
        <path d="M200 452 H320" />
        <Ground x={260} y={452} />
      </Wires>
      <T x={260} y={445}>CHASSIS GROUND</T>
      <Markers points={C_POINTS} clamps={C_CLAMPS} />
    </svg>
  );
}

// ---------- furnace ----------

const F_POINTS: Record<FTestPointId, Pt> = {
  F_SW_LINE: [50, 34, 'w'],
  F_SW_LOAD: [50, 76, 'w'],
  F_DS_IN: [50, 100, 'w'],
  F_DS_OUT: [50, 142, 'w'],
  F_BD_L1: [50, 174, 'w'],
  F_SW_N: [470, 34, 'e'],
  F_BD_N: [470, 174, 'e'],
  F_IND_H: [150, 205, 'n'],
  F_IND_N: [400, 205, 'n'],
  F_IGN_H: [150, 245, 'n'],
  F_IGN_N: [400, 245, 'n'],
  F_BLW_H: [150, 285, 'n'],
  F_BLW_N: [400, 285, 'n'],
  F_BCAP_A: [335, 317, 'n'],
  F_BCAP_B: [400, 317, 's'],
  F_BD_SEC: [80, 404, 'w'],
  F_BD_C: [440, 404, 'e'],
  F_BD_R: [165, 435, 'n'],
  F_BD_W: [265, 435, 'n'],
  F_PS_A: [120, 475, 'n'],
  F_PS_B: [240, 475, 'n'],
  F_LIM_A: [120, 515, 'n'],
  F_LIM_B: [240, 515, 'n'],
  F_GV_MV: [352, 555, 'n'],
  F_GV_C: [420, 555, 'n'],
  F_BD_FS: [160, 600, 'n'],
  F_FS_ROD: [300, 600, 'n'],
  F_SW_GND: [450, 600, 'n'],
};

const F_CLAMPS: Record<FClampPointId, Xy> = {
  F_W_L1: [50, 158],
  F_W_IND: [200, 205],
  F_W_IGN: [200, 245],
  F_W_BLW: [175, 285],
  F_W_GV: [328, 555],
};

function FurnaceDiagram({ trace }: { trace: boolean }): ReactNode {
  return (
    <svg viewBox="0 0 520 650" role="img" aria-label="Gas furnace ladder wiring diagram">
      <rect width={520} height={650} fill={PAPER} />
      {trace && <FurnaceTrace />}
      <T x={260} y={16} bold size={10}>
        LINE VOLTAGE - 120 V
      </T>
      <T x={50} y={22} bold>
        L1
      </T>
      <T x={470} y={22} bold>
        N
      </T>
      <Wires color={INK}>
        <path d="M50 34 V365 M470 34 V365" />
        <path d="M50 205 H470 M50 245 H470 M50 285 H470 M50 365 H470" />
        <path d="M200 285 V317 H430 V285" />
        <Dot x={200} y={285} />
        <Dot x={430} y={285} />
        <Switch x={50} y={55} v />
        <Switch x={50} y={121} v />
        <Contact x={100} y={205} />
        <Contact x={100} y={245} />
        <Contact x={100} y={285} />
        <Load x={270} y={205} text="M" />
        <Resistor x={270} y={245} />
        <Winding x={270} y={285} />
        <Winding x={270} y={317} />
        <Capacitor x={367} y={317} />
        <Winding x={260} y={365} turns={6} />
        <path d="M228 373 H292 M228 377 H292" strokeWidth={1.1} />
      </Wires>
      <T x={66} y={58} anchor="start">
        SERVICE SWITCH
      </T>
      <T x={66} y={124} anchor="start">
        DOOR SWITCH
      </T>
      <T x={100} y={225}>K1</T>
      <T x={100} y={265}>K2</T>
      <T x={100} y={305}>K3</T>
      <T x={270} y={228}>INDUCER MOTOR</T>
      <T x={270} y={262}>HOT SURFACE IGNITER</T>
      <T x={270} y={276}>BLOWER RUN</T>
      <T x={270} y={331}>BLOWER START</T>
      <T x={367} y={335}>RUN CAP</T>
      <T x={260} y={353}>TRANSFORMER 120 V / 24 V</T>

      <T x={260} y={408} bold size={10}>
        24 V CONTROL
      </T>
      <Wires color={LOW_VOLT}>
        <path d="M230 385 H80 V515 M290 385 H440 V555" />
        <path d="M80 435 H440 M80 475 H440 M80 515 H440 M280 515 V555 H440" />
        <path d="M130 600 H300" />
        <path d="M300 600 H380" strokeDasharray="2 4" />
        <Dot x={280} y={515} />
        <Winding x={260} y={385} turns={6} flip />
        <Fuse x={120} y={435} />
        <Switch x={215} y={435} />
        <Switch x={180} y={475} />
        <Switch x={180} y={515} closed />
        <Box x={360} y={435} text="W input" />
        <Box x={360} y={475} text="PS input" />
        <Box x={360} y={515} text="Limit input" />
        <Contact x={305} y={555} />
        <Load x={388} y={555} text="GV" />
        <Box x={105} y={600} text="Flame sense" w={62} />
      </Wires>
      <T x={120} y={451}>3 A FUSE</T>
      <T x={215} y={451}>THERMOSTAT</T>
      <T x={180} y={491}>PRESSURE SWITCH</T>
      <T x={180} y={531}>HIGH LIMIT</T>
      <T x={305} y={575}>K4</T>
      <T x={388} y={580}>GAS VALVE</T>
      <T x={338} y={614}>flame (µA DC)</T>
      <Wires color="#2d7a46">
        <Ground x={380} y={600} />
        <Ground x={450} y={600} />
      </Wires>
      <T x={380} y={627}>BURNERS</T>
      <T x={450} y={627}>CHASSIS</T>
      <T x={20} y={642} anchor="start" size={8.5}>
        K1-K4 are relays on the control board. Boxes are control board inputs.
      </T>
      <Markers points={F_POINTS} clamps={F_CLAMPS} />
    </svg>
  );
}

// ---------- panel ----------

export function WiringDiagram({ onClose }: { onClose: () => void }): ReactNode {
  const isFurnace = useSim((s) => s.unitType === 'furnace');
  const [large, setLarge] = useState(false);
  // Tracing shows which switch is open, so it is only offered where there is no fault to find.
  const canTrace = useSim((s) => s.scenario?.id.endsWith('orientation') ?? false);
  const [wantTrace, setTrace] = useState(false);
  const trace = canTrace && wantTrace;
  return (
    <aside className={`diagram${large ? ' large' : ''}`} aria-label="Wiring diagram">
      <header>
        <strong>Wiring diagram - {isFurnace ? 'gas furnace' : 'condensing unit'}</strong>
        <span className="spacer" />
        <button
          type="button"
          className={trace ? 'on' : ''}
          disabled={!canTrace}
          title={canTrace ? 'Highlight every wire that has voltage on it' : 'Only on orientation calls - on a fault call, trace it with your meter'}
          onClick={() => setTrace((v) => !v)}
        >
          Trace power
        </button>
        <button type="button" onClick={() => setLarge((v) => !v)}>
          {large ? 'Smaller' : 'Larger'}
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </header>
      {isFurnace ? <FurnaceDiagram trace={trace} /> : <CondenserDiagram trace={trace} />}
      <p className="legend">
        {trace ? <><i className="lead-hot" /> has voltage right now.</> : "Drawn with power off, as on the unit's label."} <i className="lead-red" /> red lead <i className="lead-black" /> black
        lead <i className="lead-clamp" /> clamp. Hover a terminal for its name.
      </p>
    </aside>
  );
}
