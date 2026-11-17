import { type ReactNode, useEffect, useRef, useState } from "react";
import { useView } from "../scene/Scene";
import { useAuth } from "../store/useAuth";
import { useChat } from "../store/useChat";
import { browserCanTranscribe, useDictation } from "../store/useDictation";
import {
  type LayoutConfig,
  effectiveLayout,
  presetOf,
  useLayout,
} from "../store/useLayout";
import { useSim } from "../store/useSim";
import { api } from "../api/client";
import { ThermostatDialog } from "./Thermostat";
import { useCoarsePointer, useDictationNotices, useJobViews, useWindowWidth } from "./layoutHooks";
import { AudioSettings } from "./AudioSettings";
import { useControls } from "../store/useControls";

/** A pushpin: pinned elements stay in their column or row; unpinned ones open from a button. */
export function PinButton({
  pinned,
  label,
  onClick,
}: {
  pinned: boolean;
  label: string;
  onClick: () => void;
}): ReactNode {
  const title = pinned
    ? `Unpin the ${label} (open it from a button instead)`
    : `Pin the ${label} in place`;
  return (
    <button
      type="button"
      className={`icon-button pin${pinned ? " pinned" : ""}`}
      aria-pressed={pinned}
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill={pinned ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 3h6l-1 6 4 4H6l4-4z" />
        <line x1="12" y1="13" x2="12" y2="21" />
      </svg>
    </button>
  );
}

/** Camera views: a pinned row of buttons, or one button showing the current view that opens a pull-down menu. */
export function ViewsControl(): ReactNode {
  const views = useJobViews();
  const current = useView((s) => s.view);
  const go = useView((s) => s.go);
  const placement = useLayout((s) => s.config.views);
  const open = useLayout((s) => s.surface === "views");
  const { set, toggle, open: show } = useLayout.getState();
  if (placement === "pinned") {
    return (
      <nav className="views" aria-label="Camera views">
        {views.map((view, index) => (
          <button
            key={view.label}
            type="button"
            title={`${view.label} (${index + 1})`}
            aria-pressed={view.label === current.label}
            onClick={() => go(view)}
          >
            {view.label}
          </button>
        ))}
        <PinButton
          pinned
          label="view buttons"
          onClick={() => set({ views: "floating" })}
        />
      </nav>
    );
  }
  return (
    <div className="popover-anchor">
      <button
        type="button"
        className="menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Camera views (V)"
        onClick={() => toggle("views")}
      >
        <span className="menu-button-label">View:</span> {current.label}{" "}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="sheet-scrim clear" onClick={() => show(null)} />
          <div
            className="popover views-menu"
            role="menu"
            aria-label="Camera views"
          >
            <div className="panel-heading">
              <h2>Views</h2>
              <PinButton
                pinned={false}
                label="view buttons"
                onClick={() => {
                  set({ views: "pinned" });
                  show(null);
                }}
              />
            </div>
            {views.map((view, index) => (
              <button
                key={view.label}
                type="button"
                role="menuitemradio"
                aria-checked={view.label === current.label}
                onClick={() => {
                  go(view);
                  show(null);
                }}
              >
                <span className="check" aria-hidden="true">
                  {view.label === current.label ? "✓" : ""}
                </span>
                <span>{view.label}</span>
                <kbd>{index + 1}</kbd>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function useUnseenReplies(): number {
  const replies = useChat(
    (s) => s.messages.filter((m) => m.role === "assistant").length,
  );
  const seen = useLayout((s) => s.seenReplies);
  return Math.max(0, replies - seen);
}

/** Top-bar button for the job drawer, with a badge for tutor replies not yet seen. */
export function JobButton(): ReactNode {
  const open = useLayout((s) => s.drawerOpen);
  const unseen = useUnseenReplies();
  return (
    <button
      type="button"
      className={`ghost job-button${open ? " active" : ""}`}
      aria-expanded={open}
      aria-controls="job-drawer"
      title="Work order, readings and tutor (J)"
      onClick={() => useLayout.getState().setDrawer(!open)}
    >
      Job
      {unseen > 0 && (
        <span
          className="count-badge"
          aria-label={`${unseen} new tutor ${unseen === 1 ? "reply" : "replies"}`}
        >
          {unseen}
        </span>
      )}
    </button>
  );
}

/**
 * The job panel as an inspector drawer (Keynote/Pages style): it slides over the 3D view from the
 * right, or up from the bottom in portrait, and stays open until closed. Kept mounted so a chat
 * draft survives closing it.
 */
export function JobDrawer({ children }: { children: ReactNode }): ReactNode {
  const open = useLayout((s) => s.drawerOpen);
  const replies = useChat(
    (s) => s.messages.filter((m) => m.role === "assistant").length,
  );
  const { setDrawer, set, markRepliesSeen } = useLayout.getState();
  useEffect(() => {
    if (open) markRepliesSeen(replies);
  }, [open, replies, markRepliesSeen]);
  return (
    <aside
      id="job-drawer"
      className={`job-drawer${open ? " open" : ""}`}
      aria-label="Job"
      aria-hidden={!open}
      inert={!open}
    >
      <div className="panel-heading drawer-heading">
        <span className="drawer-grip" aria-hidden="true" />
        <h2>Job</h2>
        <PinButton
          pinned={false}
          label="job panel"
          onClick={() => {
            set({ jobPanel: "pinned" });
            setDrawer(false);
          }}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Close the job drawer"
          onClick={() => setDrawer(false)}
        >
          ✕
        </button>
      </div>
      {children}
    </aside>
  );
}

/** A strip on the right edge of the 3D view: swipe left on it to open the job drawer. */
export function DrawerEdge(): ReactNode {
  const start = useRef<number | null>(null);
  return (
    <div
      className="drawer-edge"
      aria-hidden="true"
      onPointerDown={(e) => {
        start.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current !== null && start.current - e.clientX > 40) {
          start.current = null;
          useLayout.getState().setDrawer(true);
        }
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    />
  );
}

/** "⋯" menu for less frequent actions, so the top bar stays uncluttered on a tablet. */
export function OverflowMenu({
  onAbandon,
}: {
  onAbandon: () => void;
}): ReactNode {
  const open = useLayout((s) => s.surface === "menu");
  const user = useAuth((s) => s.user);
  const { toggle, open: show } = useLayout.getState();
  return (
    <div className="popover-anchor">
      <button
        type="button"
        className="ghost icon-button more"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        title="More"
        onClick={() => toggle("menu")}
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="sheet-scrim clear" onClick={() => show(null)} />
          <div className="popover overflow-menu align-right" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                show(null);
                onAbandon();
              }}
            >
              Abandon job
            </button>
            {user && (
              <>
                <hr />
                <p className="menu-note" title={user.email}>
                  {user.fname} {user.lname} · {user.email}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    show(null);
                    try {
                      await api.logout();
                    } catch {
                      /* Discard the in-memory session even if offline. */
                    } finally {
                      useAuth.getState().clearSession();
                    }
                  }}
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Pinned thermostat: on the corner of the 3D view, with a pin to move it into the top bar. */
export function PinnedThermostat({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const set = useLayout((s) => s.set);
  return (
    <div className="tstat-pinned no-callout">
      {children}
      <PinButton
        pinned
        label="thermostat"
        onClick={() => set({ thermostat: "floating" })}
      />
    </div>
  );
}

/** Floating thermostat: a top-bar button showing the mode and setpoint; any press opens the full thermostat dialog. */
export function ThermostatControl(): ReactNode {
  const [open, setOpen] = useState(false);
  const summary = useSim((s) =>
    s.tstat.mode === "off"
      ? "Off"
      : `${s.tstat.mode === "heat" ? "Heat" : "Cool"} ${s.tstat.setpointF}°`,
  );
  const set = useLayout((s) => s.set);
  return (
    <>
      <button
        type="button"
        className={`ghost no-callout${open ? " active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Thermostat"
        onClick={() => setOpen(true)}
      >
        Thermostat
        {summary && <span className="menu-button-label"> · {summary}</span>}
      </button>
      {open && (
        <ThermostatDialog
          onClose={() => setOpen(false)}
          headingActions={
            <PinButton
              pinned={false}
              label="thermostat"
              onClick={() => {
                set({ thermostat: "pinned" });
                setOpen(false);
              }}
            />
          }
        />
      )}
    </>
  );
}

const SWITCHES: Array<{
  key: keyof Omit<LayoutConfig, "version">;
  label: string;
  detail: string;
  on: LayoutConfig[keyof LayoutConfig];
  off: LayoutConfig[keyof LayoutConfig];
}> = [
  {
    key: "toolBag",
    label: "Pin the tool bag",
    detail: "Off: a Tools button opens it as a sheet.",
    on: "pinned",
    off: "floating",
  },
  {
    key: "views",
    label: "Pin the view buttons",
    detail: "Off: one View button opens a menu.",
    on: "pinned",
    off: "floating",
  },
  {
    key: "jobPanel",
    label: "Pin the job panel",
    detail: "Off: a Job button opens it as a drawer.",
    on: "pinned",
    off: "floating",
  },
  {
    key: "largeTargets",
    label: "Large touch targets",
    detail: "At least 44 points, for fingers.",
    on: true,
    off: false,
  },
  {
    key: "thermostat",
    label: "Pin the thermostat",
    detail:
      "On the corner of the 3D view. Off: a Thermostat button in the top bar.",
    on: "pinned",
    off: "floating",
  },
];

const PRESET_CARDS = [
  {
    id: "desk" as const,
    title: "Desktop/Laptop",
    detail:
      "Three columns: tool bag, 3D view, job panel. Best on a large screen.",
  },
  {
    id: "focus" as const,
    title: "iPad",
    detail:
      "The 3D view fills the screen. Tools, views and the job open from the top bar. Best on an iPad.",
  },
];

/** Layout settings: presets, one switch per element, and a JSON file to move the layout between machines. */
export function LayoutPanel(): ReactNode {
  const open = useLayout((s) => s.surface === "settings");
  const config = useLayout((s) => s.config);
  const {
    set,
    applyPreset,
    importText,
    exportText,
    open: show,
  } = useLayout.getState();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"layout" | "display" | "audio">("layout");
  const wheelDownZoomsIn = useControls((s) => s.wheelDownZoomsIn);
  const setWheelDownZoomsIn = useControls((s) => s.setWheelDownZoomsIn);
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  const width = useWindowWidth();
  if (!open) return null;
  const preset = presetOf(config);
  const squeezed = effectiveLayout(
    config,
    width,
    width <= 1100 ? 290 : 340,
  ).squeezed;
  return (
    <dialog
      ref={dialog}
      className="dialog layout-panel"
      aria-labelledby="layout-title"
      onClose={() => show(null)}
    >
      <div className="panel-heading">
        <h2 id="layout-title">Settings</h2>
      </div>
      <div
        className="settings-tabs"
        role="tablist"
        aria-label="Settings sections"
      >
        {(["layout", "display", "audio"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`settings-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`settings-${id}`}
            onClick={() => setTab(id)}
          >
            {id === "layout" ? "Layout" : id === "display" ? "Display" : "Audio"}
          </button>
        ))}
      </div>
      {tab === "audio" && <AudioSettings />}
      {tab === "display" && (
        <section
          id="settings-display"
          role="tabpanel"
          aria-labelledby="settings-tab-display"
          className="settings-section"
        >
          <ul className="layout-switches">
            <li>
              <label>
                <input
                  type="checkbox"
                  role="switch"
                  checked={config.instrumentsPanel}
                  onChange={() =>
                    set({ instrumentsPanel: !config.instrumentsPanel })
                  }
                />
                <span>
                  <strong>Show INSTRUMENTS in the job panel</strong>
                  <small>
                    Readings always show on the tools in the 3D view. Turn this
                    on to repeat them in the job panel too.
                  </small>
                </span>
              </label>
            </li>
            <li>
              <label>
                <input
                  type="checkbox"
                  role="switch"
                  checked={wheelDownZoomsIn}
                  onChange={() => setWheelDownZoomsIn(!wheelDownZoomsIn)}
                />
                <span>
                  <strong>Roll the mouse wheel down to zoom in</strong>
                  <small>
                    Off: roll up (away from you) to zoom in, as most 3D apps
                    do. On: the reverse.
                  </small>
                </span>
              </label>
            </li>
          </ul>
        </section>
      )}
      {tab === "layout" && (
        <section
          id="settings-layout"
          role="tabpanel"
          aria-labelledby="settings-tab-layout"
          className="settings-section"
        >
          <div
            className="layout-presets"
            role="group"
            aria-label="Layout presets"
          >
            {PRESET_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                aria-pressed={preset === card.id}
                onClick={() => applyPreset(card.id)}
              >
                <span
                  className={`layout-preview ${card.id}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                </span>
                <strong>{card.title}</strong>
                <span>{card.detail}</span>
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <p className="fine">
              Custom layout. Pick a preset above to start again from it.
            </p>
          )}
          {squeezed && (
            <p className="fine warn-note">
              This window is too narrow for every pinned column, so some open
              from the top bar for now. They return when the window is wider.
            </p>
          )}
          <ul className="layout-switches">
            {SWITCHES.map((item) => {
              const checked = config[item.key] === item.on;
              return (
                <li key={item.key}>
                  <label>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={checked}
                      onChange={() =>
                        set({ [item.key]: checked ? item.off : item.on })
                      }
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="fine">
            Saved in this browser. To use the same layout on another computer or
            iPad, export it and import the file there.
          </p>
          <div className="layout-actions">
            <button
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([exportText()], { type: "application/json" }),
                );
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = "hvac-sim-layout.json";
                anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export layout
            </button>
            <button type="button" onClick={() => file.current?.click()}>
              Import layout…
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => applyPreset("desk")}
            >
              Reset to Desk
            </button>
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (event) => {
                const chosen = event.target.files?.[0];
                event.target.value = "";
                if (!chosen) return;
                try {
                  importText(await chosen.text());
                  setError(null);
                } catch (reason) {
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Could not import that layout.",
                  );
                }
              }}
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <details className="layout-shortcuts">
            <summary>Keyboard shortcuts</summary>
            <dl>
              <dt>
                <kbd>T</kbd>
              </dt>
              <dd>Tool bag</dd>
              <dt>
                <kbd>V</kbd>
              </dt>
              <dd>Views menu</dd>
              <dt>
                <kbd>1</kbd>–<kbd>9</kbd>
              </dt>
              <dd>Jump to a view</dd>
              <dt>
                <kbd>J</kbd>
              </dt>
              <dd>Job drawer</dd>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>Close</dd>
            </dl>
          </details>
        </section>
      )}
      <div className="settings-footer">
        <button type="button" className="primary" onClick={() => show(null)}>
          OK
        </button>
      </div>
    </dialog>
  );
}

/** One-time question on a touch screen or a narrow window. */
export function FirstRunPrompt(): ReactNode {
  const prompted = useLayout((s) => s.prompted);
  const coarse = useCoarsePointer();
  const width = useWindowWidth();
  if (prompted || (!coarse && width >= 1200)) return null;
  const { answerPrompt } = useLayout.getState();
  return (
    <div
      className="layout-prompt"
      role="dialog"
      aria-labelledby="layout-prompt-title"
    >
      <strong id="layout-prompt-title">Use the Focus layout?</strong>
      <p>
        Gives the 3D view the whole screen. Tools, views and the job open from
        the top bar. You can change this later under ⋯ → Layout.
      </p>
      <div>
        <button
          type="button"
          className="primary"
          onClick={() => answerPrompt(true)}
        >
          Use Focus
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => answerPrompt(false)}
        >
          Keep Desk
        </button>
      </div>
    </div>
  );
}

/**
 * Voice input, always the right-most top-bar item in every layout. Speech goes into the tutor's chat
 * box (opening the job drawer if it is closed) for the learner to check and send.
 */
export function MicButton(): ReactNode {
  const { listening, interim, error, hint, toggle } = useDictation();
  useDictationNotices();
  const label = listening
    ? "Stop voice input"
    : browserCanTranscribe()
      ? "Ask the tutor by voice"
      : "Dictate into the chat box";
  return (
    <div className="popover-anchor mic-anchor">
      <button
        type="button"
        className={`icon-button mic-button no-callout${listening ? " listening" : ""}`}
        aria-pressed={listening}
        aria-label={label}
        title={label}
        onClick={() => {
          if (!listening && document.getElementById("job-drawer"))
            useLayout.getState().setDrawer(true);
          toggle();
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="21" />
        </svg>
      </button>
      {(listening || error || hint) && (
        <div className={`mic-status${error ? " error" : ""}`} role="status">
          {listening
            ? interim || "Listening…"
            : [error, hint].filter(Boolean).join(" ")}
        </div>
      )}
    </div>
  );
}
