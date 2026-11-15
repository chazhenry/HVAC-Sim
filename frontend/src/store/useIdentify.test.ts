import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyBlocksClick, useIdentify } from './useIdentify';

describe('press-and-hold identify', () => {
  afterEach(() => {
    vi.useRealTimers();
    useIdentify.setState({ active: false, suppressUntil: 0 });
  });

  it('lets ordinary taps through', () => {
    expect(identifyBlocksClick()).toBe(false);
  });

  it('blocks part clicks during a hold and for the click sent when the finger lifts', () => {
    vi.useFakeTimers();
    useIdentify.getState().begin(100, 200);
    expect(identifyBlocksClick()).toBe(true);
    useIdentify.getState().end();
    expect(useIdentify.getState().active).toBe(false);
    expect(identifyBlocksClick()).toBe(true);
    vi.advanceTimersByTime(450);
    expect(identifyBlocksClick()).toBe(false);
  });

  it('tracks the finger while sliding', () => {
    useIdentify.getState().begin(10, 20);
    useIdentify.getState().move(30, 40);
    expect(useIdentify.getState()).toMatchObject({ active: true, x: 30, y: 40 });
  });
});
