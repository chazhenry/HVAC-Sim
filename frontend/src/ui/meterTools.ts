import type { AppState } from '../store/useSim';
import { MODES } from './meterFormat';

/** Tools drawn as a hand-held instrument (which hides the normal cursor over the 3D view). */
export const isMeterTool = (tool: string): boolean =>
  tool === 'clamp' || tool === 'multimeter' || tool === 'ncv' || tool === 'tempclamp';

/** Range dial positions for the equipment on this job. */
export const meterModes = (s: Pick<AppState, 'unitType'>): typeof MODES => MODES.filter((m) => s.unitType === 'furnace' || !m.furnaceOnly);
