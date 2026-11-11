import type { ReactNode } from 'react';
import {
  ATMOSPHERE_MICRONS,
  type CenterHose,
  cylinderFill,
  NAMEPLATE_TEST_PSIG,
  RECOVERY_CYLINDER_LB,
  RECOVERY_CYLINDER_START_LB,
  type TestGas,
} from '../sim/service';
import { useSim } from '../store/useSim';

const HOSES: ReadonlyArray<{ id: CenterHose; label: string }> = [
  { id: 'none', label: 'Capped' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'nitrogen', label: 'Nitrogen' },
  { id: 'vacuum', label: 'Vacuum' },
  { id: 'cylinder', label: 'R-410A' },
];

const GASES: ReadonlyArray<{ id: TestGas; label: string }> = [
  { id: 'nitrogen', label: 'Dry nitrogen' },
  { id: 'air', label: 'Shop air' },
  { id: 'oxygen', label: 'Oxygen' },
];

const REGULATOR_SETTINGS = [150, 250, 400] as const;

const lbOz = (lb: number): string => {
  const totalOz = Math.round(lb * 16);
  return `${Math.floor(totalOz / 16)} lb ${totalOz % 16} oz`;
};

const microns = (m: number): string => (m >= 20000 ? 'over range' : `${Math.round(m).toLocaleString()} microns`);

/**
 * The equipment on the far end of the manifold's yellow hose: recovery
 * machine, nitrogen, vacuum pump or refrigerant cylinder.
 */
export function ServiceCart(): ReactNode {
  const svc = useSim((s) => s.sim?.service);
  const ready = useSim((s) => s.gauges.low && s.gauges.high);
  const isProcedure = useSim((s) => s.scenario?.id === 'c-608-drier');
  const setHose = useSim((s) => s.serviceHose);
  const toggle = useSim((s) => s.serviceToggle);
  const release = useSim((s) => s.serviceRelease);
  const open = useSim((s) => s.serviceOpen);
  const set = useSim((s) => s.serviceSet);
  if (!svc) return null;

  const fill = cylinderFill(svc);
  const underVacuum = svc.microns < ATMOSPHERE_MICRONS;
  return (
    <div className="cart">
      <div className="cart-row">
        <span className="cart-label">Yellow hose to</span>
        <div className="seg wrap" role="group" aria-label="Centre hose connection">
          {HOSES.map((h) => (
            <button
              key={h.id}
              type="button"
              className={svc.hose === h.id ? 'on' : ''}
              disabled={!ready && h.id !== 'none'}
              onClick={() => setHose(h.id)}
            >
              {h.label}
            </button>
          ))}
        </div>
      </div>
      {!ready && <p className="fine">Connect both gauge hoses to use the service equipment.</p>}

      {svc.hose === 'recovery' && (
        <>
          <button type="button" className={svc.running ? 'running' : ''} onClick={toggle}>
            {svc.running ? 'Stop recovery machine' : 'Start recovery machine'}
          </button>
          <dl className="kv">
            <dt>Recovery cylinder</dt>
            <dd>
              {lbOz(RECOVERY_CYLINDER_START_LB + svc.recoveredLb)} of {RECOVERY_CYLINDER_LB} lb
            </dd>
            <dt>Fill</dt>
            <dd className={fill > 0.8 ? 'bad' : ''}>{Math.round(fill * 100)}% (limit 80%)</dd>
            <dt>Recovered this job</dt>
            <dd>{lbOz(svc.recoveredLb)}</dd>
          </dl>
        </>
      )}

      {svc.hose === 'nitrogen' && (
        <>
          <div className="cart-row">
            <span className="cart-label">Gas</span>
            <div className="seg wrap">
              {GASES.map((g) => (
                <button key={g.id} type="button" className={svc.testGas === g.id ? 'on' : ''} onClick={() => set({ testGas: g.id })}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="cart-row">
            <span className="cart-label">Regulator</span>
            <div className="seg wrap">
              {REGULATOR_SETTINGS.map((p) => (
                <button key={p} type="button" className={svc.regulatorPsig === p ? 'on' : ''} onClick={() => set({ regulatorPsig: p })}>
                  {p} psig
                </button>
              ))}
            </div>
          </div>
          <div className="charge">
            <button type="button" className={svc.running ? 'running' : ''} onClick={toggle}>
              {svc.running ? 'Close cylinder' : 'Pressurise'}
            </button>
            <button type="button" onClick={release}>
              Release to air
            </button>
          </div>
          <p className="fine">Nameplate test pressure: {NAMEPLATE_TEST_PSIG} psig. Watch the gauges hold.</p>
        </>
      )}

      {svc.hose === 'vacuum' && (
        <button type="button" className={svc.running ? 'running' : ''} onClick={toggle}>
          {svc.running ? 'Valve off and stop pump' : 'Start vacuum pump'}
        </button>
      )}
      {(svc.hose === 'vacuum' || underVacuum) && (
        <dl className="kv">
          <dt>Micron gauge</dt>
          <dd className="strong">{microns(svc.microns)}</dd>
          <dt>Standing test</dt>
          <dd>
            {svc.running && svc.hose === 'vacuum'
              ? 'pump running'
              : svc.heldMicrons !== null
                ? svc.heldMicrons <= 500
                  ? 'held under 500'
                  : 'rose above 500'
                : underVacuum
                  ? `watching… ${Math.floor(svc.heldFor)} s`
                  : '- -'}
          </dd>
        </dl>
      )}

      {svc.hose === 'cylinder' && (
        <>
          <button type="button" className={svc.running ? 'running' : ''} onClick={toggle}>
            {svc.running ? 'Close cylinder valve' : 'Open cylinder valve'}
          </button>
          <dl className="kv">
            <dt>Scale: added this job</dt>
            <dd className="strong">{lbOz(svc.addedLb)}</dd>
          </dl>
          <p className="fine">Weigh in the nameplate charge after a repair, or top up by subcooling.</p>
        </>
      )}

      {isProcedure && (
        <button type="button" className="repair" onClick={open} disabled={svc.opened}>
          {svc.opened ? 'Filter drier replaced' : 'Open system and replace filter drier'}
        </button>
      )}
    </div>
  );
}
