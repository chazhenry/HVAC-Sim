import { create } from 'zustand';

/**
 * Job-screen layout, chosen per browser and exportable as a JSON file.
 * "pinned" keeps an element in its column or row as on a desktop; "floating" turns it into a
 * sheet, menu or drawer opened from the top bar, leaving the 3D view the whole screen (iPad).
 */
export type Placement = 'pinned' | 'floating';

export interface LayoutConfig {
  version: 1;
  /** Column 1, or a sheet opened from the Tools button. */
  toolBag: Placement;
  /** A row of camera buttons, or one button showing the current view that opens a menu. */
  views: Placement;
  /** The right-hand column, or a drawer that slides over the view. */
  jobPanel: Placement;
  /** 44-point minimum touch targets (Apple's guideline). */
  largeTargets: boolean;
  /** On the corner of the 3D view, or a Thermostat button in the top bar that opens it. */
  thermostat: Placement;
  /**
   * Display setting, not part of a preset: also show the INSTRUMENTS readouts in the job panel.
   * Readings always show on the tools in the 3D view.
   */
  instrumentsPanel: boolean;
}

export type PresetId = 'desk' | 'focus';

export const PRESETS: Record<PresetId, LayoutConfig> = {
  desk: { version: 1, toolBag: 'pinned', views: 'pinned', jobPanel: 'pinned', largeTargets: false, thermostat: 'pinned', instrumentsPanel: true },
  focus: { version: 1, toolBag: 'floating', views: 'floating', jobPanel: 'floating', largeTargets: true, thermostat: 'floating', instrumentsPanel: true },
};

const KEYS = ['toolBag', 'views', 'jobPanel', 'largeTargets', 'thermostat'] as const;

export function presetOf(config: LayoutConfig): PresetId | 'custom' {
  const match = (Object.keys(PRESETS) as PresetId[]).find((id) => KEYS.every((key) => PRESETS[id][key] === config[key]));
  return match ?? 'custom';
}

const placement = (value: unknown): value is Placement => value === 'pinned' || value === 'floating';

/** Validates a saved or imported layout; anything unknown or malformed falls back to Desk values. */
export function parseLayout(value: unknown): LayoutConfig | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return null;
  const base = PRESETS.desk;
  return {
    version: 1,
    toolBag: placement(raw.toolBag) ? raw.toolBag : base.toolBag,
    views: placement(raw.views) ? raw.views : base.views,
    jobPanel: placement(raw.jobPanel) ? raw.jobPanel : base.jobPanel,
    largeTargets: typeof raw.largeTargets === 'boolean' ? raw.largeTargets : base.largeTargets,
    // 'full' and 'chip' come from the first version of this setting.
    thermostat: placement(raw.thermostat) ? raw.thermostat
      : raw.thermostat === 'chip' ? 'floating' : raw.thermostat === 'full' ? 'pinned' : base.thermostat,
    instrumentsPanel: typeof raw.instrumentsPanel === 'boolean' ? raw.instrumentsPanel : base.instrumentsPanel,
  };
}

const STORAGE_KEY = 'hvac-sim.layout';

interface Saved {
  config: LayoutConfig;
  /** The first-run "Use the Focus layout?" question has been answered. */
  prompted: boolean;
}

function load(): Saved {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    const saved = raw as Partial<Saved> | null;
    const config = parseLayout(saved?.config);
    if (config) {
      return { config, prompted: saved?.prompted === true };
    }
  } catch {
    // Unreadable or blocked storage: start from Desk.
  }
  return { config: PRESETS.desk, prompted: false };
}

function save(state: Saved): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: state.config, prompted: state.prompted }));
  } catch {
    // Storage can be blocked; the layout then lasts for this visit only.
  }
}

/** Which floating surface is open. Only one at a time, like iPad popovers. */
export type Surface = 'tools' | 'views' | 'menu' | 'settings' | null;

interface LayoutState extends Saved {
  surface: Surface;
  drawerOpen: boolean;
  /** Tutor replies already seen, for the badge on the Job button. */
  seenReplies: number;
  set: (patch: Partial<Omit<LayoutConfig, 'version'>>) => void;
  applyPreset: (id: PresetId) => void;
  answerPrompt: (useFocus: boolean) => void;
  importText: (text: string) => void;
  exportText: () => string;
  open: (surface: Surface) => void;
  toggle: (surface: Exclude<Surface, null>) => void;
  setDrawer: (open: boolean) => void;
  markRepliesSeen: (count: number) => void;
}

export const useLayout = create<LayoutState>()((set, get) => {
  const persist = (patch: Partial<Saved>): void => {
    set(patch);
    const { config, prompted } = get();
    save({ config, prompted });
  };
  return {
    ...load(),
    surface: null,
    drawerOpen: false,
    seenReplies: 0,
    set: (patch) => persist({ config: { ...get().config, ...patch } }),
    // A preset changes the layout only; display settings such as instrumentsPanel are kept.
    applyPreset: (id) => persist({ config: { ...PRESETS[id], instrumentsPanel: get().config.instrumentsPanel } }),
    answerPrompt: (useFocus) => persist({
      prompted: true,
      ...(useFocus ? { config: { ...PRESETS.focus, instrumentsPanel: get().config.instrumentsPanel } } : {}),
    }),
    importText: (text) => {
      if (text.length > 16_000) throw new Error('Layout files must be under 16 KB.');
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new Error('That file is not valid JSON.'); }
      const config = parseLayout(parsed);
      if (!config) throw new Error('That is not an HVAC-Sim layout file (version 1).');
      persist({ config });
    },
    exportText: () => JSON.stringify(get().config, null, 2) + '\n',
    open: (surface) => set({ surface }),
    toggle: (surface) => set((state) => ({ surface: state.surface === surface ? null : surface })),
    setDrawer: (drawerOpen) => set({ drawerOpen }),
    markRepliesSeen: (count) => set({ seenReplies: count }),
  };
});

/** Pinned columns this wide leave the 3D view at least MIN_VIEW px; below that they float instead. */
export const TOOL_COLUMN_PX = 208;
export const MIN_VIEW_PX = 520;

/**
 * The placement actually used. A pinned element that would squeeze the 3D view below
 * MIN_VIEW_PX floats instead (the job panel first, then the tool bag); the saved choice is kept.
 */
export function effectiveLayout(config: LayoutConfig, windowWidth: number, jobWidth: number): {
  toolBag: Placement; jobPanel: Placement; squeezed: boolean;
} {
  let toolBag = config.toolBag;
  let jobPanel = config.jobPanel;
  const room = (): number => windowWidth - (toolBag === 'pinned' ? TOOL_COLUMN_PX : 0) - (jobPanel === 'pinned' ? jobWidth : 0);
  if (room() < MIN_VIEW_PX && jobPanel === 'pinned') jobPanel = 'floating';
  if (room() < MIN_VIEW_PX && toolBag === 'pinned') toolBag = 'floating';
  return { toolBag, jobPanel, squeezed: toolBag !== config.toolBag || jobPanel !== config.jobPanel };
}
