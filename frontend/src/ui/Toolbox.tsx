import type { ReactNode } from 'react';
import type { UnitType } from '../api/types';
import { type ToolId, useSim } from '../store/useSim';
import { toolIconUrl } from './toolIcons';

interface ToolDef {
  id: ToolId;
  name: string;
  badge: string;
  how: string;
}

interface ToolGroup {
  title: string;
  tone: 'steel' | 'amber' | 'blue' | 'green';
  tools: readonly ToolDef[];
}

const TONE_COLOR: Record<ToolGroup['tone'], string> = {
  steel: '#b6c0cb',
  amber: '#f5a623',
  blue: '#5aa2f0',
  green: '#4fbf7a',
};

const MULTIMETER: ToolDef = {
  id: 'multimeter',
  name: 'Multimeter',
  badge: 'MM',
  how: 'Click two terminals to place the red and black leads. Pick the range on the meter. Click a lead again to lift it.',
};
const CLAMP: ToolDef = { id: 'clamp', name: 'Clamp meter', badge: 'CA', how: 'Click a wire to read the current flowing in it.' };
const NCV: ToolDef = {
  id: 'ncv',
  name: 'Voltage tester',
  badge: 'NC',
  how: 'Non-contact tester. Click a terminal - it lights red if the terminal is hot.',
};
const DISCHARGE: ToolDef = {
  id: 'discharge',
  name: 'Cap discharge',
  badge: 'DC',
  how: 'With power off, click the capacitor to bleed off its stored charge before testing or handling it.',
};

const CONDENSER_GROUPS: readonly ToolGroup[] = [
  {
    title: 'Hands & access',
    tone: 'steel',
    tools: [
      { id: 'hand', name: 'Hand', badge: 'HA', how: 'Click the disconnect cover to open it, and the pull-out to kill or restore power.' },
      { id: 'nutdriver', name: 'Nut driver', badge: 'ND', how: 'Click a panel to remove it (access panel, front louver panel) or to swing the fan top up. Click it again to refit.' },
    ],
  },
  { title: 'Electrical', tone: 'amber', tools: [MULTIMETER, CLAMP, NCV, DISCHARGE] },
  {
    title: 'Refrigeration',
    tone: 'blue',
    tools: [
      { id: 'gauges', name: 'Manifold gauges', badge: 'MG', how: 'Click the suction and liquid service ports to connect the blue and red hoses.' },
      { id: 'tempclamp', name: 'Temp clamps', badge: 'TC', how: 'Click the suction and liquid lines to clamp on thermocouples - needed for superheat and subcooling.' },
      { id: 'hose', name: 'Coil cleaner', badge: 'CC', how: 'With power off and the front louver panel removed, click the coil to wash it.' },
    ],
  },
  {
    title: 'Parts bin',
    tone: 'green',
    tools: [
      { id: 'part_capacitor', name: 'Capacitor 45/5', badge: 'uF', how: 'Click the old capacitor to swap it. Power off and discharge it first.' },
      { id: 'part_contactor', name: 'Contactor', badge: 'CT', how: 'Click the old contactor to swap it. Power off first.' },
      { id: 'part_fanmotor', name: 'Fan motor', badge: 'FM', how: 'Swing the fan top up, then click the fan motor to swap it. Power off first.' },
      { id: 'part_fuses', name: 'Fuses 30 A', badge: 'FU', how: 'Open the disconnect, pull it out, then click the pull-out head to fit new fuses.' },
    ],
  },
];

const SWAP = 'Turn the service switch off, then click the old part to swap it.';

const FURNACE_GROUPS: readonly ToolGroup[] = [
  {
    title: 'Hands & access',
    tone: 'steel',
    tools: [
      { id: 'hand', name: 'Hand', badge: 'HA', how: 'Lift the doors off, flip the service switch, turn the gas shut-off, and tape down the door switch to run with the blower door off.' },
    ],
  },
  { title: 'Electrical', tone: 'amber', tools: [MULTIMETER, CLAMP, NCV, DISCHARGE] },
  {
    title: 'Combustion & air',
    tone: 'blue',
    tools: [
      { id: 'manometer', name: 'Manometer', badge: 'MN', how: 'Click a pressure tap: the two on the gas valve (inlet, manifold) or the one on the pressure switch hose (draft).' },
      { id: 'thermo', name: 'Temp probes', badge: 'TP', how: 'Click the supply plenum and the return duct to read temperature rise across the furnace.' },
      { id: 'emery', name: 'Abrasive pad', badge: 'AB', how: 'With power off, click the flame sensor to pull it and polish the rod.' },
    ],
  },
  {
    title: 'Parts bin',
    tone: 'green',
    tools: [
      { id: 'part_igniter', name: 'Igniter', badge: 'IG', how: SWAP },
      { id: 'part_flamesensor', name: 'Flame sensor', badge: 'FS', how: SWAP },
      { id: 'part_pswitch', name: 'Pressure switch', badge: 'PS', how: SWAP },
      { id: 'part_inducer', name: 'Inducer', badge: 'IN', how: SWAP },
      { id: 'part_gasvalve', name: 'Gas valve', badge: 'GV', how: 'Close the gas shut-off and turn the service switch off, then click the old valve.' },
      { id: 'part_blowercap', name: 'Blower cap 7.5', badge: 'uF', how: 'Power off and discharge the old capacitor, then click it to swap.' },
      { id: 'part_filter', name: 'Air filter', badge: 'AF', how: 'Click the filter in its rack beside the furnace to slide in a new one.' },
      { id: 'part_fuse3a', name: 'Fuse 3 A', badge: 'FU', how: 'Power off, then click the fuse on the control board.' },
      { id: 'part_limit', name: 'Limit switch', badge: 'LS', how: SWAP },
      { id: 'part_board', name: 'Control board', badge: 'CB', how: SWAP },
    ],
  },
];

const GROUPS: Record<UnitType, readonly ToolGroup[]> = { condenser: CONDENSER_GROUPS, furnace: FURNACE_GROUPS };

export function Toolbox(): ReactNode {
  const tool = useSim((s) => s.tool);
  const unitType = useSim((s) => s.unitType);
  const setTool = useSim((s) => s.setTool);
  const groups = GROUPS[unitType];
  const active = groups.flatMap((g) => g.tools).find((t) => t.id === tool);
  return (
    <aside className="toolbox">
      <h2>Tool bag</h2>
      {groups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <div className="tool-grid">
            {group.tools.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tool tone-${group.tone}${tool === t.id ? ' active' : ''}`}
                aria-pressed={tool === t.id}
                onClick={() => setTool(t.id)}
              >
                <span className="tool-head">
                  <span className="badge">{t.badge}</span>
                  <span
                    className="tool-icon"
                    aria-hidden="true"
                    style={{ backgroundImage: toolIconUrl(t.id, TONE_COLOR[group.tone]) }}
                  />
                </span>
                <span className="tool-name">{t.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {active && (
        <p className="tool-how">
          <strong>{active.name}:</strong> {active.how}
        </p>
      )}
    </aside>
  );
}
