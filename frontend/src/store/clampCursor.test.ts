import { describe, expect, it } from 'vitest';
import { clampReason } from '../scene/clampNotes';
import { nextScale } from '../ui/meterScale';

describe('clamp meter size (Ctrl + wheel)', () => {
  it('grows on wheel up, shrinks on wheel down, within limits', () => {
    expect(nextScale(1, -100)).toBe(1.1);
    expect(nextScale(1, 100)).toBe(0.91);
    expect(nextScale(3, -100)).toBe(3);
    expect(nextScale(0.5, 100)).toBe(0.5);
  });
});

describe('clicking something that cannot be clamped', () => {
  it('explains wire-like objects by kind, and says plainly when it is not a wire', () => {
    expect(clampReason('24 V control cable linking the outdoor board and indoor air handler')).toMatch(/control current is too small/);
    expect(clampReason('Fan motor wiring harness')).toMatch(/bundled leads cancel/);
    expect(clampReason('Liquid line filter drier')).toMatch(/^not a wire/);
  });
});

describe('click toast beside the tool icon', () => {
  it('goes beside the icon on the side of the 3D view with more room, centred on it', async () => {
    const { iconBox, toastBesideIcon } = await import('../ui/toastPlacement');
    const view = { left: 0, top: 50, right: 1200, bottom: 800 };
    // A 76 x 128 clamp meter with its hot spot at 38, 30, clicked at 300, 400.
    const meter = iconBox(300, 400, { width: 76, height: 128, hotX: 38, hotY: 30 });
    expect(meter).toEqual({ left: 262, top: 370, right: 338, bottom: 498 });
    // More room on the right: the toast starts just past the icon's right edge, centred on the icon.
    expect(toastBesideIcon(meter, 200, 40, view)).toEqual({ left: 338 + 14, top: 434 - 20 });
    // Near the right edge: the toast ends just before the icon's left edge.
    const right = iconBox(1000, 400, { width: 32, height: 32, hotX: 2, hotY: 2 });
    expect(toastBesideIcon(right, 200, 40, view).left).toBe(998 - 14 - 200);
    // Kept inside the view vertically.
    expect(toastBesideIcon(iconBox(300, 790, { width: 32, height: 32, hotX: 2, hotY: 2 }), 200, 40, view).top).toBe(760);
  });
});

describe('instrument size ranges', () => {
  it('lets the small voltage tester and temp clamp grow much larger, and shrink less', async () => {
    const { nextScale, scaleRange } = await import('../ui/meterScale');
    expect(scaleRange('ncv')).toEqual({ min: 0.75, max: 6 });
    expect(scaleRange('tempclamp').max).toBe(6);
    expect(nextScale(5.9, -100, scaleRange('ncv'))).toBe(6);
    expect(nextScale(0.76, 100, scaleRange('tempclamp'))).toBe(0.75);
    // The clamp meter and multimeter keep their range.
    expect(scaleRange('clamp')).toEqual({ min: 0.5, max: 3 });
  });
});
