import type { ReactNode } from 'react';
import { CollapsibleCard } from './CollapsibleCard';
import { useSim } from '../store/useSim';
import { ChatPanel } from './ChatPanel';
import { EquipmentStatus } from './EquipmentStatus';
import { ProcedureProgress } from './ProcedureProgress';
import { Instruments, useInstrumentNames } from './Instruments';
import { useLayout } from '../store/useLayout';
import { PinButton } from './LayoutControls';

/** Right-hand pane: the work order and instrument readouts, with the chat filling the rest. */
export function JobPanel({ pinned = false }: { pinned?: boolean }): ReactNode {
  const scenario = useSim((s) => s.scenario);
  const set = useLayout((s) => s.set);
  const showInstruments = useLayout((s) => s.config.instrumentsPanel);
  const instruments = useInstrumentNames().join(', ');
  if (!scenario) return null;
  return (
    <aside className="jobpanel">
      {pinned && <div className="jobpanel-pin"><PinButton pinned label="job panel" onClick={() => set({ jobPanel: 'floating' })} /></div>}
      <div className="jobpanel-top">
        <CollapsibleCard id="work-order" title="Work order" summary={<h3 className="job-title">{scenario.title}</h3>}>
          <p className="complaint">{scenario.complaint}</p>
        </CollapsibleCard>

        <EquipmentStatus />
        <ProcedureProgress />

        {/* Readings always show on the 3D tools; this repeats them here when turned on in Settings > Display. */}
        {showInstruments && (
          <CollapsibleCard id="instruments" title="Instruments" {...(instruments ? { detail: instruments } : {})}>
            <Instruments />
          </CollapsibleCard>
        )}
      </div>
      <ChatPanel />
    </aside>
  );
}
