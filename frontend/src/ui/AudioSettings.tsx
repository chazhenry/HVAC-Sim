import type { ReactNode } from 'react';
import { playTone, TONE_NAMES, type ToneId } from '../audio/tones';
import { CUES, useAudio } from '../store/useAudio';

const TONES = Object.keys(TONE_NAMES) as ToneId[];

/** Settings > Audio: sound on/off, volume, and the tone for each success or fail moment. */
export function AudioSettings(): ReactNode {
  const { enabled, volume, tones, setEnabled, setVolume, setTone, resetTones } = useAudio();
  return (
    <section id="settings-audio" role="tabpanel" aria-labelledby="settings-tab-audio" className="settings-section">
      <ul className="layout-switches">
        <li><label>
          <input type="checkbox" role="switch" checked={enabled} onChange={() => setEnabled(!enabled)} />
          <span><strong>Sound effects</strong><small>Short tones when something succeeds or fails.</small></span>
        </label></li>
      </ul>
      <label className="audio-volume">
        <span>Volume</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} disabled={!enabled}
          onChange={(event) => setVolume(Number(event.target.value))}
          onPointerUp={() => playTone(tones.clampOn, volume)} />
        <span className="audio-volume-value">{Math.round(volume * 100)}%</span>
      </label>
      {(['success', 'fail'] as const).map((kind) => (
        <fieldset key={kind} className="audio-cues" disabled={!enabled}>
          <legend>{kind === 'success' ? 'Success' : 'Fail'}</legend>
          {CUES.filter((cue) => cue.kind === kind).map((cue) => (
            <div key={cue.id} className="audio-cue">
              <label htmlFor={`tone-${cue.id}`}>{cue.label}</label>
              <select id={`tone-${cue.id}`} value={tones[cue.id]} onChange={(event) => {
                const tone = event.target.value as ToneId;
                setTone(cue.id, tone);
                playTone(tone, volume);
              }}>
                {TONES.map((tone) => <option key={tone} value={tone}>{TONE_NAMES[tone]}</option>)}
              </select>
              <button type="button" className="icon-button" aria-label={`Play the ${cue.label.toLowerCase()} sound`}
                title="Play" onClick={() => playTone(tones[cue.id], volume)}>▶</button>
            </div>
          ))}
        </fieldset>
      ))}
      <div className="layout-actions">
        <button type="button" className="ghost" onClick={resetTones}>Reset sounds to defaults</button>
      </div>
    </section>
  );
}
