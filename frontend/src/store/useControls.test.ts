import { describe, expect, it } from 'vitest';
import { useControls } from './useControls';

describe('mouse wheel zoom direction', () => {
  it('defaults to roll up to zoom in, and can be reversed', () => {
    // Node has no localStorage, so this is the fresh-browser default.
    expect(useControls.getState().wheelDownZoomsIn).toBe(false);
    useControls.getState().setWheelDownZoomsIn(true);
    expect(useControls.getState().wheelDownZoomsIn).toBe(true);
    useControls.getState().setWheelDownZoomsIn(false);
    expect(useControls.getState().wheelDownZoomsIn).toBe(false);
  });
});
