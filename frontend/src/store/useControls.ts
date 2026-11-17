import { create } from 'zustand';

const STORAGE_KEY = 'hvac-sim.controls';

/** How the 3D view responds to the mouse. Kept per browser. */
interface ControlSettings {
  /**
   * false (default): roll the wheel up / away to zoom in, down / toward you to zoom out.
   * true: the reverse, roll down to zoom in.
   */
  wheelDownZoomsIn: boolean;
}

function load(): ControlSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ControlSettings> | null;
    return { wheelDownZoomsIn: raw?.wheelDownZoomsIn === true };
  } catch {
    return { wheelDownZoomsIn: false };
  }
}

interface ControlState extends ControlSettings {
  setWheelDownZoomsIn: (on: boolean) => void;
}

export const useControls = create<ControlState>()((set, get) => ({
  ...load(),
  setWheelDownZoomsIn: (wheelDownZoomsIn) => {
    set({ wheelDownZoomsIn });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wheelDownZoomsIn: get().wheelDownZoomsIn }));
    } catch {
      // Storage can be blocked; the choice then lasts for this visit only.
    }
  },
}));
