import type { ReactNode } from 'react';
import { useSim } from '../store/useSim';
import { downloadContext } from './EquipmentPicker';

export function EquipmentStatus(): ReactNode {
  const context = useSim((s) => s.context);
  const hp = useSim((s) => s.sim?.heatPump);
  const test = useSim((s) => s.testDefrost);
  if (!context) return null;
  return <section className="card equipment-status">
    <h2>{context.manufacturer} · {context.outdoorModel}</h2>
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
      <button type="button" onClick={test} disabled={hp.stage !== 'idle'}>Defrost board TEST</button>
      <p className="fine">TEST advances the timer only with a running heat call and a closed coil sensor. Shift delays and thermal ramps are modeled.</p>
    </>}
    <button type="button" onClick={() => downloadContext(context)}>Save configuration JSON</button>
  </section>;
}
