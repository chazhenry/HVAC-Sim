import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLAMP_NOTES } from '../scene/clampNotes';
import { useSim } from './useSim';

describe('clamp meter on an irrelevant wire', () => {
  afterEach(() => {
    vi.useRealTimers();
    useSim.setState({ tool: 'hand', clampAt: null, clampRejected: false });
  });

  it('warns tersely, names the wire still being read, and shows the ✕ briefly', () => {
    vi.useFakeTimers();
    useSim.setState({ tool: 'clamp', clampAt: 'W_L1' });
    const ground = CLAMP_NOTES.gnd!;
    useSim.getState().rejectClamp(ground.name, ground.why);
    const entry = useSim.getState().log.at(-1)!;
    expect(entry.kind).toBe('warn');
    expect(entry.text).toMatch(/^Clamp: Ground wire - carries no current/);
    expect(entry.text).toMatch(/Meter still reading: /);
    // The reading stays on the wire already clamped.
    expect(useSim.getState().clampAt).toBe('W_L1');
    expect(useSim.getState().clampRejected).toBe(true);
    vi.advanceTimersByTime(2600);
    expect(useSim.getState().clampRejected).toBe(false);
  });

  it('does nothing unless the clamp meter is in hand', () => {
    useSim.setState({ tool: 'multimeter' });
    const before = useSim.getState().log.length;
    useSim.getState().rejectClamp('Ground wire', 'no current');
    expect(useSim.getState().log.length).toBe(before);
    expect(useSim.getState().clampRejected).toBe(false);
  });
});

describe('switching tools', () => {
  it('clears everything the previous tool had on the unit', () => {
    useSim.setState({ tool: 'clamp', clampAt: 'W_L1', ncvAt: null, leads: { red: 'L1', black: null } as never });
    useSim.getState().setTool('multimeter');
    expect(useSim.getState().clampAt).toBeNull();
    // Leads belonged to the multimeter, which was not the previous tool, so they are untouched here...
    expect(useSim.getState().leads.red).toBe('L1');
    // ...and come off when the multimeter is put down.
    useSim.getState().setTool('gauges');
    expect(useSim.getState().leads.red).toBeNull();
    useSim.setState({ gauges: { low: true, high: true } });
    useSim.getState().setTool('tempclamp');
    expect(useSim.getState().gauges).toEqual({ low: false, high: false });
    useSim.setState({ tempClamps: { suction: true, liquid: true } });
    useSim.getState().setTool('hand');
    expect(useSim.getState().tempClamps).toEqual({ suction: false, liquid: false });
    useSim.setState({ tool: 'ncv', ncvAt: 'L1' as never });
    useSim.getState().setTool('hand');
    expect(useSim.getState().ncvAt).toBeNull();
    useSim.setState({ leads: { red: null, black: null }, tool: 'hand' });
  });
});
