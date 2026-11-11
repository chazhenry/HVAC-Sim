import { type ReactNode, useEffect, useRef } from 'react';
import { boardPowered, FAULT_CODES } from '../sim/furnace/engine';
import { useSim } from '../store/useSim';
import { Instruments } from './Instruments';

function FurnaceObservations(): ReactNode {
  const powered = useSim((s) => (s.furnace ? boardPowered(s.furnace) : false));
  const code = useSim((s) => s.furnace?.board.code ?? 0);
  const inducer = useSim((s) => (s.furnace?.inducerSpeed ?? 0) > 0.4);
  const glow = useSim((s) => (s.furnace?.igniterTemp ?? 0) > 0.6);
  const flame = useSim((s) => s.furnace?.flame ?? false);
  const blower = useSim((s) => s.furnace?.blower ?? 'off');
  const blowing = useSim((s) => (s.furnace?.blowerSpeed ?? 0) > 0.4);
  const rows: Array<[string, string]> = [
    ['Board LED', powered ? FAULT_CODES[code] : 'off - no power at the board'],
    ['Inducer', inducer ? 'running' : 'stopped'],
    ['Igniter', glow ? 'glowing orange' : 'dark'],
    ['Burners', flame ? 'lit, blue flame' : 'no flame'],
    ['Blower', blowing ? 'moving air' : blower === 'locked' ? 'humming, not turning' : 'stopped'],
  ];
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Observations(): ReactNode {
  const fan = useSim((s) => s.sim?.fan ?? 'off');
  const spinning = useSim((s) => (s.sim?.fanSpeed ?? 0) > 0.4);
  const compressor = useSim((s) => s.sim?.compressor ?? 'off');
  const suctionCold = useSim((s) => (s.sim?.thermo.suctionLineF ?? 99) < 62);
  const power = useSim((s) => s.sim?.controls.disconnectIn ?? true);
  const rows: Array<[string, string]> = [
    ['Disconnect', power ? 'in' : 'pulled'],
    ['Condenser fan', spinning ? 'spinning' : fan === 'locked' ? 'buzzing, not turning' : 'stopped'],
    [
      'Compressor',
      compressor === 'running' ? 'running' : compressor === 'locked' ? 'loud hum, not running' : 'silent',
    ],
    ['Suction line', suctionCold ? 'cold to the touch' : 'not cold'],
  ];
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Log(): ReactNode {
  const log = useSim((s) => s.log);
  const end = useRef<HTMLLIElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [log.length]);
  return (
    <ol className="log" aria-live="polite">
      {log.map((entry) => (
        <li key={entry.id} className={`log-${entry.kind}`}>
          <time>{`${Math.floor(entry.t / 60)}:${String(Math.floor(entry.t % 60)).padStart(2, '0')}`}</time>
          {entry.text}
        </li>
      ))}
      <li ref={end} />
    </ol>
  );
}

export function JobPanel(): ReactNode {
  const scenario = useSim((s) => s.scenario);
  const isFurnace = useSim((s) => s.unitType === 'furnace');
  const tstat = useSim((s) => s.tstat);
  const env = useSim((s) => (s.sim ?? s.furnace)?.env);
  const setThermostat = useSim((s) => s.setThermostat);
  if (!scenario || !env) return null;
  return (
    <aside className="jobpanel">
      <section className="card">
        <h2>Work order</h2>
        <h3 className="job-title">{scenario.title}</h3>
        <p className="complaint">{scenario.complaint}</p>
      </section>

      <section className="card thermostat">
        <div>
          <h2>Thermostat</h2>
          <p className="fine">
            Indoor {env.indoorF.toFixed(0)} °F · set {tstat.setpointF} °F · outdoor {env.outdoorF.toFixed(0)} °F
          </p>
        </div>
        <div className="seg" role="group" aria-label="Thermostat mode">
          <button type="button" className={tstat.mode === 'off' ? 'on' : ''} onClick={() => setThermostat({ mode: 'off' })}>
            Off
          </button>
          <button
            type="button"
            className={tstat.mode !== 'off' ? (isFurnace ? 'on heat' : 'on cool') : ''}
            onClick={() => setThermostat({ mode: isFurnace ? 'heat' : 'cool' })}
          >
            {isFurnace ? 'Heat' : 'Cool'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Instruments</h2>
        <Instruments />
      </section>

      <section className="card">
        <h2>What you see and hear</h2>
        {isFurnace ? <FurnaceObservations /> : <Observations />}
      </section>

      <section className="card grow">
        <h2>Job log</h2>
        <Log />
      </section>
    </aside>
  );
}
