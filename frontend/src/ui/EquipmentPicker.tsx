import { type ReactNode, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { EquipmentContext } from "../api/types";

export function downloadContext(context: EquipmentContext): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(context, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${context.id}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const MAX_BYTES = 128_000;

/** The featured unit: selected when the menu opens and listed first. */
export const DEFAULT_CONTEXT_ID = "goodman-gszb403610";

/** Built-in equipment with the featured unit first, the rest in catalog order. */
export function orderContexts(contexts: EquipmentContext[]): EquipmentContext[] {
  return [
    ...contexts.filter((context) => context.id === DEFAULT_CONTEXT_ID),
    ...contexts.filter((context) => context.id !== DEFAULT_CONTEXT_ID),
  ];
}

/** Equipment configuration JSON, validated by the server. */
async function parseContext(text: string): Promise<EquipmentContext> {
  if (text.length > MAX_BYTES) throw new Error("Equipment files must be under 128 KB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That is not valid JSON.");
  }
  return api.validateContext(parsed);
}

const message = (reason: unknown): string =>
  reason instanceof Error ? reason.message : "Invalid equipment configuration.";

/** "2. Equipment": pick the unit; the gear in the corner saves, loads or edits its configuration. */
export function EquipmentPicker({
  contexts,
  selected,
  onSelect,
}: {
  contexts: EquipmentContext[];
  selected: EquipmentContext;
  onSelect: (context: EquipmentContext) => void;
}): ReactNode {
  const [imported, setImported] = useState<EquipmentContext[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const use = (context: EquipmentContext): void => {
    setImported((items) => [...items.filter((item) => item.id !== context.id), context]);
    onSelect(context);
  };

  const load = async (text: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      use(await parseContext(text));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };

  const options = [
    ...orderContexts(contexts).filter((context) => !imported.some((item) => item.id === context.id)),
    ...imported,
  ];
  return (
    <section className="equipment-picker" aria-label="Equipment context">
      <div className="equipment-heading">
        <h2>2. Equipment</h2>
        <div className="popover-anchor equipment-gear-anchor">
          <button type="button" className="icon-button equipment-gear" aria-haspopup="menu" aria-expanded={menu}
            aria-label="Equipment configuration" title="Equipment configuration" disabled={busy}
            onClick={() => setMenu((open) => !open)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
              <path d="m10 3-.5 2-1.7 1-2-.6-2 3.4 1.5 1.4v2l-1.5 1.4 2 3.4 2-.6 1.7 1 .5 2h4l.5-2 1.7-1 2 .6 2-3.4-1.5-1.4v-2l1.5-1.4-2-3.4-2 .6-1.7-1L14 3Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {menu && (
            <>
              <div className="sheet-scrim clear" onClick={() => setMenu(false)} />
              <div className="popover align-right equipment-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); downloadContext(selected); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" /><path d="M8 4v5h7V4" /><rect x="8" y="13" width="8" height="5" rx="0.5" /></svg>
                  Save configuration JSON
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); input.current?.click(); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg>
                  Load configuration JSON…
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setEditing(true); }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
                  Edit context…
                </button>
              </div>
            </>
          )}
          <input
            ref={input}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > MAX_BYTES) {
                setError("Equipment files must be under 128 KB.");
                return;
              }
              void file.text().then(load).catch(() => setError("Could not read the equipment file."));
            }}
          />
        </div>
      </div>
      <div className="equipment-options" role="group" aria-label="Choose equipment">
        {options.map((context) => (
          <button
            key={context.id}
            type="button"
            disabled={busy}
            aria-pressed={selected.id === context.id}
            onClick={() => onSelect(context)}
          >
            <strong>{context.name}</strong>
            <span>
              {context.outdoorModel} · {context.indoorModel}
            </span>
          </button>
        ))}
      </div>
      {busy && <p className="fine">Validating the equipment file…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {editing && <EditContextDialog selected={selected} onApply={use} onClose={() => setEditing(false)} />}
    </section>
  );
}

/** "Edit context": a copy of the selected configuration as JSON; Apply validates it and selects it. */
function EditContextDialog({ selected, onApply, onClose }: {
  selected: EquipmentContext;
  onApply: (context: EquipmentContext) => void;
  onClose: () => void;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => JSON.stringify(selected, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // No close() in a cleanup: React runs effects twice in development, and closing would fire onClose
  // and unmount the editor at once. Removing the element closes the modal anyway.
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="dialog context-editor" aria-labelledby="context-editor-title" onClose={onClose}>
      <h2 id="context-editor-title">Edit context</h2>
      <p className="fine">
        Edit a copy of this configuration, give it a new ID and name, then apply it. Use Save configuration JSON
        afterwards to keep it as a file.
      </p>
      <textarea
        aria-label="Equipment configuration JSON"
        className="equipment-json"
        spellCheck={false}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="context-editor-actions">
        <button type="button" className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary" disabled={busy} onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            onApply(await parseContext(draft));
            onClose();
          } catch (reason) {
            setError(message(reason));
          } finally {
            setBusy(false);
          }
        }}>
          {busy ? "Validating…" : "Apply configuration"}
        </button>
      </div>
    </dialog>
  );
}
