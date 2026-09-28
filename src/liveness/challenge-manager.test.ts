import { describe, expect, it } from 'vitest';
import { pickChallenges } from './challenge-manager';

describe('pickChallenges', () => {
  it('always includes a head turn in 3D Active Motion, never beside a nod', () => {
    for (let i = 0; i < 200; i += 1) {
      const types = pickChallenges({ mode: 'gestures' }).map((c) => c.type);
      expect(types).toContain('turn');
      expect(types).not.toContain('nod');
      expect(new Set(types).size).toBe(types.length);
      expect(types).toHaveLength(2);
    }
  });

  it('keeps the order random: the turn is not always first', () => {
    const firsts = new Set(Array.from({ length: 200 }, () => pickChallenges({ mode: 'gestures' })[0]!.type));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('runs the gestures then the flash in Dual Check', () => {
    const types = pickChallenges({ mode: 'both' }).map((c) => c.type);
    expect(types).toContain('turn');
    expect(types.at(-1)).toBe('flash');
  });

  it('asks only for the flash in 3D Flash Check, and only for a hold in Passive Liveness', () => {
    expect(pickChallenges({ mode: 'flash' }).map((c) => c.type)).toEqual(['flash']);
    expect(pickChallenges({ mode: 'passive' }).map((c) => c.type)).toEqual(['hold']);
  });
});
