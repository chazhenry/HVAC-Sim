import { type ReactNode, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ModelChoice, ModelSettings as Settings } from '../api/types';

const PROVIDER_NAMES: Record<string, string> = { openai: 'OpenAI', deepseek: 'DeepSeek', anthropic: 'Anthropic' };
const providerName = (id: string): string => PROVIDER_NAMES[id] ?? id;

/** "deepseek:deepseek-flash" as "DeepSeek · deepseek-flash". */
export function modelLabel(id: string | null): string {
  if (!id) return 'None (no API key is set)';
  const [provider = '', ...rest] = id.split(':');
  return `${providerName(provider)} · ${rest.join(':')}`;
}

const SETTINGS = [
  { key: 'chatbot' as const, title: 'Chatbot', detail: 'Answers questions in the job panel chat.' },
  { key: 'router' as const, title: 'Router', detail: 'Decides which part of the app handles a request.' },
];

/** Settings > Models: the system-wide chatbot and router models. Only the site owner can change them. */
export function ModelSettings(): ReactNode {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    api.models().then((data) => { if (live) setSettings(data); })
      .catch((reason: unknown) => { if (live) setError(reason instanceof Error ? reason.message : 'Could not load the models.'); });
    return () => { live = false; };
  }, []);

  const change = (key: 'chatbot' | 'router', value: string): void => {
    setSaving(true);
    setError(null);
    api.setModels({ [key]: value }).then(setSettings)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not change the model.'))
      .finally(() => setSaving(false));
  };

  const providers = settings ? [...new Set(settings.options.map((o) => o.provider))] : [];
  const option = (o: ModelChoice): ReactNode => (
    <option key={o.id} value={o.id} disabled={!o.available}>
      {modelLabel(o.id)}{o.available ? '' : ` (${o.reason ?? 'unavailable'})`}
    </option>
  );

  return (
    <section id="settings-models" role="tabpanel" aria-labelledby="settings-tab-models" className="settings-section">
      {!settings && !error && <p className="fine">Loading models…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {settings && (
        <>
          <p className="fine">
            {settings.canEdit
              ? 'System-wide: a change applies to every user right away.'
              : 'The models the simulator uses for everyone. Only the site owner can change them.'}
          </p>
          <div className="model-settings">
            {SETTINGS.map(({ key, title, detail }) => (
              <div key={key} className="model-setting">
                <label htmlFor={`model-${key}`}>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </label>
                {settings.canEdit ? (
                  <select id={`model-${key}`} value={settings[key] ?? ''} disabled={saving}
                    onChange={(event) => change(key, event.target.value)}>
                    {!settings[key] && <option value="" disabled>Choose a model</option>}
                    {providers.map((provider) => (
                      <optgroup key={provider} label={providerName(provider)}>
                        {settings.options.filter((o) => o.provider === provider).map(option)}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <output id={`model-${key}`} className="model-current">{modelLabel(settings[key])}</output>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
