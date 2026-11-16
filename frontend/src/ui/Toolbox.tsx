import type { ReactNode } from 'react';
import { useLayout } from '../store/useLayout';
import { PinButton } from './LayoutControls';
import { useSim } from '../store/useSim';
import { toolIconUrl } from './toolIcons';
import { type PlacedTool, useToolGroups } from './toolGroups';
import { useVideos } from '../store/useVideos';

function ToolTile({ item, active, onPick }: { item: PlacedTool; active: boolean; onPick: () => void }): ReactNode {
  return (
    <button type="button" className={`tool tone-${item.tone}${active ? ' active' : ''}`}
      aria-pressed={active} onClick={onPick}>
      <span className="tool-icon" aria-hidden="true" style={{ backgroundImage: toolIconUrl(item.id, item.color) }} />
      <span className="tool-name">{item.name}</span>
    </button>
  );
}

/** Every tool, grouped, with the active tool's how-to underneath. */
function ToolBag({ onPicked }: { onPicked?: () => void }): ReactNode {
  const tool = useSim((s) => s.tool);
  const setTool = useSim((s) => s.setTool);
  const groups = useToolGroups();
  const active = groups.flatMap((g) => g.tools).find((t) => t.id === tool);
  return (
    <>
      {groups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <div className="tool-grid">
            {group.tools.map((t) => (
              <ToolTile key={t.id} item={t} active={tool === t.id} onPick={() => {
                // First Principles is a library, not a tool to hold: it opens the video list instead.
                if (t.id === 'firstprinciples') useVideos.getState().openMenu();
                else setTool(t.id);
                onPicked?.();
              }} />
            ))}
          </div>
        </section>
      ))}
      {active && (
        <p className="tool-how">
          <strong>{active.name}:</strong> {active.how}
        </p>
      )}
    </>
  );
}

/** Top-bar button for the floating tool bag, showing the tool in hand. */
export function ToolsButton(): ReactNode {
  const tool = useSim((s) => s.tool);
  const open = useLayout((s) => s.surface === 'tools');
  const current = useToolGroups().flatMap((group) => group.tools).find((item) => item.id === tool);
  return (
    <button type="button" className={`ghost tools-button${open ? ' active' : ''}`} aria-expanded={open}
      title={`Tool bag (T)${current ? ` · holding: ${current.name}` : ''}`} onClick={() => useLayout.getState().toggle('tools')}>
      {current && <span className="tools-button-icon" aria-hidden="true" style={{ backgroundImage: toolIconUrl(current.id, current.color) }} />}
      Tools
      {current && <span className="visually-hidden">: {current.name}</span>}
    </button>
  );
}

/** Pinned tool bag: column 1 of the job screen. */
export function Toolbox(): ReactNode {
  const set = useLayout((s) => s.set);
  return (
    <aside className="toolbox" aria-label="Tool bag">
      <div className="panel-heading">
        <h2>Tool bag</h2>
        <PinButton pinned label="tool bag" onClick={() => set({ toolBag: 'floating' })} />
      </div>
      <ToolBag />
    </aside>
  );
}

/** Floating tool bag: a popover under the Tools button (a bottom sheet on narrow screens). Picking a tool closes it. */
export function ToolSheet(): ReactNode {
  const open = useLayout((s) => s.surface === 'tools');
  const close = (): void => useLayout.getState().open(null);
  const set = useLayout((s) => s.set);
  if (!open) return null;
  return (
    <>
      <div className="sheet-scrim" onClick={close} />
      <section className="sheet tool-sheet" role="dialog" aria-modal="false" aria-label="Tool bag">
        <div className="panel-heading">
          <h2>Tool bag</h2>
          <PinButton pinned={false} label="tool bag" onClick={() => { set({ toolBag: 'pinned' }); close(); }} />
          <button type="button" className="icon-button" aria-label="Close tool bag" onClick={close}>✕</button>
        </div>
        <div className="sheet-body toolbox-body">
          <ToolBag onPicked={close} />
        </div>
      </section>
    </>
  );
}
