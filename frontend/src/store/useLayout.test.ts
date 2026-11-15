import { describe, expect, it } from 'vitest';
import { MIN_VIEW_PX, PRESETS, TOOL_COLUMN_PX, effectiveLayout, parseLayout, presetOf, useLayout } from './useLayout';

describe('layout presets', () => {
  it('recognises Desk, Focus and a custom mix', () => {
    expect(presetOf(PRESETS.desk)).toBe('desk');
    expect(presetOf(PRESETS.focus)).toBe('focus');
    // A PC user who keeps only the tool bag pinned.
    expect(presetOf({ ...PRESETS.focus, toolBag: 'pinned' })).toBe('custom');
  });
});

describe('parseLayout', () => {
  it('accepts an exported layout file', () => {
    expect(parseLayout(JSON.parse(JSON.stringify(PRESETS.focus)))).toEqual(PRESETS.focus);
  });

  it('rejects files that are not a version 1 layout', () => {
    expect(parseLayout(null)).toBeNull();
    expect(parseLayout('focus')).toBeNull();
    expect(parseLayout({ ...PRESETS.focus, version: 2 })).toBeNull();
  });

  it('falls back to Desk values for unknown or malformed fields', () => {
    expect(parseLayout({ version: 1, toolBag: 'sideways', largeTargets: 'yes', jobPanel: 'floating' })).toEqual({ ...PRESETS.desk, jobPanel: 'floating' });
  });

  it('keeps the Display setting when a preset is applied', () => {
    useLayout.getState().set({ instrumentsPanel: false });
    useLayout.getState().applyPreset('focus');
    expect(useLayout.getState().config).toEqual({ ...PRESETS.focus, instrumentsPanel: false });
    expect(presetOf(useLayout.getState().config)).toBe('focus');
    useLayout.getState().applyPreset('desk');
    useLayout.getState().set({ instrumentsPanel: true });
  });

  it('reads thermostat values saved by the first version, and ignores the retired dock setting', () => {
    expect(parseLayout({ version: 1, thermostat: 'chip', dock: true })).toEqual({ ...PRESETS.desk, thermostat: 'floating' });
    expect(parseLayout({ version: 1, thermostat: 'full' })).toEqual(PRESETS.desk);
  });
});

describe('effectiveLayout', () => {
  it('keeps pinned columns when the 3D view still has room', () => {
    expect(effectiveLayout(PRESETS.desk, 1920, 340)).toEqual({ toolBag: 'pinned', jobPanel: 'pinned', squeezed: false });
  });

  it('floats the job panel first, then the tool bag, rather than squeezing the view', () => {
    const justJob = TOOL_COLUMN_PX + 340 + MIN_VIEW_PX - 1;
    expect(effectiveLayout(PRESETS.desk, justJob, 340)).toEqual({ toolBag: 'pinned', jobPanel: 'floating', squeezed: true });
    expect(effectiveLayout(PRESETS.desk, TOOL_COLUMN_PX + MIN_VIEW_PX - 1, 340)).toEqual({ toolBag: 'floating', jobPanel: 'floating', squeezed: true });
  });

  it('never changes floating elements', () => {
    expect(effectiveLayout(PRESETS.focus, 600, 340)).toEqual({ toolBag: 'floating', jobPanel: 'floating', squeezed: false });
  });
});
