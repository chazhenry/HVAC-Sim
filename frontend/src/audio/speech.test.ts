import { describe, expect, it } from 'vitest';
import { spokenText } from './speech';

describe('Speak tool wording', () => {
  it('reads part labels naturally', () => {
    expect(spokenText('Contactor L1 (line)')).toBe('Contactor L 1 line');
    expect(spokenText('Wire: Compressor common')).toBe('Wire, Compressor common');
    expect(spokenText('Condenser coil - matted with lint and cottonwood')).toBe('Condenser coil, matted with lint and cottonwood');
    expect(spokenText('Manifold gauge set - R-410A (blue = low side, red = high side)')).toContain('R 4 10 A');
  });
});
