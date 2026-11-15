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

describe('click toast beside the meter', () => {
  it('goes to the side with more room, clear of the meter, or centres when no meter is drawn', async () => {
    const { clickToastLeft } = await import('../ui/toastPlacement');
    // Click on the left half: toast to the right of a 76 px meter (half 38) plus the gap.
    expect(clickToastLeft(300, 200, 1200, 38)).toBe(300 + 38 + 14);
    // Click on the right half: toast to the left, its right edge clear of the meter.
    expect(clickToastLeft(900, 200, 1200, 38)).toBe(900 - 38 - 14 - 200);
    // No meter: centred on the click.
    expect(clickToastLeft(600, 200, 1200, null)).toBe(500);
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
