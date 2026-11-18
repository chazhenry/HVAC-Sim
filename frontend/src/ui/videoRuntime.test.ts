import { describe, expect, it } from 'vitest';
import { runtime } from './FirstPrinciples';

describe('runtime', () => {
  it('formats minutes and seconds', () => {
    expect(runtime(392)).toBe('6:32');
    expect(runtime(9.6)).toBe('0:10');
  });
  it('adds hours for long videos', () => {
    expect(runtime(3723)).toBe('1:02:03');
  });
});
