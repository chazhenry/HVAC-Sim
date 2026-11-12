import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { EquipmentContext } from '../api/types';

export function downloadContext(context: EquipmentContext): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(context, null, 2) + '\n'], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${context.id}.json`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EquipmentPicker({ contexts, selected, onSelect }: {
  contexts: EquipmentContext[]; selected: EquipmentContext; onSelect: (context: EquipmentContext) => void;
}): ReactNode {
  const [imported, setImported] = useState<EquipmentContext[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(JSON.stringify(selected, null, 2)); }, [selected]);
  const apply = async (text: string): Promise<void> => {
    setBusy(true); setError(null);
    try {
      if (text.length > 128_000) throw new Error('Equipment files must be under 128 KB.');
      const parsed: unknown = JSON.parse(text);
      const context = await api.validateContext(parsed);
      setImported((items) => [...items.filter((item) => item.id !== context.id), context]);
      onSelect(context);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid equipment configuration.'); }
    finally { setBusy(false); }
  };
  const options = [...contexts.filter((context) => !imported.some((item) => item.id === context.id)), ...imported];
  return <section className="equipment-picker" aria-label="Equipment context">
    <h2>Equipment context</h2>
    <div className="equipment-options" role="group" aria-label="Choose equipment">
      {options.map((context) => <button key={context.id} type="button" disabled={busy} aria-pressed={selected.id === context.id}
        onClick={() => onSelect(context)}><strong>{context.name}</strong><span>{context.outdoorModel} · {context.indoorModel}</span></button>)}
    </div>
    <p className="fine">{selected.notes}</p>
    <div className="equipment-actions">
      <button type="button" onClick={() => downloadContext(selected)}>Save configuration JSON</button>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Validating…' : 'Load configuration JSON'}</button>
      <input ref={input} hidden type="file" accept=".json,application/json" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (file.size > 128_000) { setError('Equipment files must be under 128 KB.'); return; }
        void file.text().then(apply).catch(() => setError('Could not read the equipment file.'));
      }} />
    </div>
    <details><summary>Create or edit a context</summary>
      <p className="fine">Edit a copy of this configuration, give it an ID and name, then apply and save it.</p>
      <textarea aria-label="Equipment configuration JSON" className="equipment-json" spellCheck={false} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button type="button" disabled={busy} onClick={() => void apply(draft)}>Apply configuration</button>
    </details>
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
