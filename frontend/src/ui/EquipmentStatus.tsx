import type { ReactNode } from 'react';
import { useSim } from '../store/useSim';
import { CollapsibleCard } from './CollapsibleCard';
import { downloadContext } from './EquipmentPicker';

const DiskIcon = (): ReactNode => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 3.5h12.5L20.5 7.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z" />
    <path d="M7.5 3.5v5h8v-5" />
    <path d="M13 5v2" />
    <rect x="7" y="13" width="10" height="7.5" rx="0.5" />
  </svg>
);

const ThermometerIcon = (): ReactNode => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />
    <circle cx="12" cy="17.8" r="1.6" fill="currentColor" />
    <path d="M12 16.2V9" />
  </svg>
);

export function EquipmentStatus(): ReactNode {
  const context = useSim((s) => s.context);
  const hp = useSim((s) => s.sim?.heatPump);
  const test = useSim((s) => s.testDefrost);
  if (!context) return null;
  const actions = <>
    {hp && (
      <button type="button" className="icon-button card-action" aria-label="Defrost board TEST" onClick={test}
        disabled={hp.stage !== 'idle'}
        title={'Defrost board TEST: short the TEST pins to speed up the defrost timer and force a defrost.\n'
          + 'Works only with a running heat call and a closed coil sensor.'}>
        <ThermometerIcon />
      </button>
    )}
    <button type="button" className="icon-button card-action" aria-label="Save configuration JSON"
      title="Save configuration JSON" onClick={() => downloadContext(context)}>
      <DiskIcon />
    </button>
  </>;
  return <CollapsibleCard id="unit" className="equipment-status" title={`${context.manufacturer} · ${context.outdoorModel}`} actions={actions}>
    <p className="fine">{context.indoorModel} · {context.capacityBtuH.toLocaleString()} BTU/h · {context.supplyVolts} V</p>
    {context.systemType !== 'gas_furnace' && <p className="fine">{context.refrigerant} · charge {context.factoryChargeLb} lb{context.seer2 ? ` · ${context.seer2} SEER2 family` : ''}</p>}
    {hp && <>
      <dl className="equipment-readings">
        <div><dt>Defrost board</dt><dd>{hp.stage.replaceAll('_', ' ')}</dd></div>
        <div><dt>O / reversing valve</dt><dd>{hp.reversingValveEnergized ? '24 V · cooling path' : '0 V · heating path'}</dd></div>
        <div><dt>Outdoor coil sensor</dt><dd>{hp.coilF.toFixed(0)} °F · {hp.sensorClosed ? 'closed' : 'open'}</dd></div>
        <div><dt>Defrost interval</dt><dd>{Math.floor(hp.heatingRunSeconds / 60)} / {hp.config.defrostIntervalMinutes} min</dd></div>
        <div><dt>Indoor ECM blower</dt><dd>{hp.indoorBlower ? 'running' : 'off'}</dd></div>
        <div><dt>W2 / auxiliary heat</dt><dd>{hp.auxiliaryHeat ? `${hp.config.auxiliaryHeatKw} kW` : 'off'}</dd></div>
      </dl>
    </>}
  </CollapsibleCard>;
}
