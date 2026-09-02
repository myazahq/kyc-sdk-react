import { describe, expect, it } from 'vitest';
import { frameFov } from './StreetViewFramer';

describe('frameFov', () => {
  it('a full-width frame captures the full viewport', () => {
    expect(frameFov(90, 1)).toBeCloseTo(90, 6);
  });

  it('an entrance-sized frame captures the slice it subtends, through the projection', () => {
    // 58% of a 90-degree view: 2·atan(0.58·tan(45°)) ≈ 60.23°, NOT 52.2° —
    // the mapping is tan-linear, not angle-linear, and the difference is the
    // gate cropped wrong at the edges.
    expect(frameFov(90, 0.58)).toBeCloseTo(60.23, 1);
  });

  it('is monotonic: a smaller frame never widens the shot', () => {
    expect(frameFov(90, 0.4)).toBeLessThan(frameFov(90, 0.6));
    expect(frameFov(120, 0.5)).toBeLessThan(120);
  });

  it('an unmeasurable fraction is floored, never zero or negative fov', () => {
    expect(frameFov(90, 0)).toBeGreaterThan(0);
    expect(frameFov(90, -3)).toBeGreaterThan(0);
  });
});
