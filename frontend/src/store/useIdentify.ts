import { create } from 'zustand';

/** How long a finger must rest on the 3D view before it identifies instead of orbiting. */
export const HOLD_MS = 400;
/** Moving further than this before the hold completes means the finger is orbiting. */
export const HOLD_SLOP_PX = 8;
/** After a hold ends, the click the browser sends on lifting the finger is ignored for this long. */
const SUPPRESS_CLICK_MS = 400;

/**
 * Press-and-hold to identify, for touch screens without hover: hold a finger on the 3D view and the
 * part under it is named above the finger; slide to move from part to part; lift to dismiss. A hold
 * never uses the tool or turns the camera.
 */
interface IdentifyState {
  active: boolean;
  x: number;
  y: number;
  suppressUntil: number;
  begin: (x: number, y: number) => void;
  move: (x: number, y: number) => void;
  end: () => void;
}

export const useIdentify = create<IdentifyState>()((set) => ({
  active: false,
  x: 0,
  y: 0,
  suppressUntil: 0,
  begin: (x, y) => set({ active: true, x, y }),
  move: (x, y) => set({ x, y }),
  end: () => set({ active: false, suppressUntil: performance.now() + SUPPRESS_CLICK_MS }),
}));

/** True while a hold is in progress or just ended, so its lift must not count as a click on a part. */
export const identifyBlocksClick = (): boolean => {
  const { active, suppressUntil } = useIdentify.getState();
  return active || performance.now() < suppressUntil;
};
