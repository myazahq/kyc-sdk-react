import { describe, expect, it } from 'vitest';
import {
  SELFIE_SHARPNESS_FLOOR,
  centreCrop,
  isSelfieBlurry,
  laplacianVariance,
  measureSelfieSharpness,
} from './selfie-sharpness';

// The pure half of the selfie focus check. The canvas decode needs a browser
// and is deliberately thin; everything that decides what a score MEANS is here.

const W = 64;
const H = 48;

const plane = (f: (x: number, y: number) => number): Uint8Array => {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) out[y * W + x] = Math.max(0, Math.min(255, Math.round(f(x, y))));
  }
  return out;
};

describe('laplacianVariance', () => {
  it('is zero on a flat plane, whatever its brightness', () => {
    expect(laplacianVariance(plane(() => 0), W, H)).toBe(0);
    expect(laplacianVariance(plane(() => 200), W, H)).toBe(0);
  });

  it('is zero on a linear gradient, which has no second derivative', () => {
    expect(laplacianVariance(plane((x) => x * 3), W, H)).toBe(0);
  });

  it('scores hard edges far above the same pattern softened', () => {
    const sharp = laplacianVariance(plane((x) => (Math.floor(x / 4) % 2 === 0 ? 0 : 255)), W, H);
    const soft = laplacianVariance(plane((x) => 127.5 + 127.5 * Math.sin((2 * Math.PI * x) / 8)), W, H);
    expect(sharp).toBeGreaterThan(soft * 10);
  });

  it('refuses a plane too small for the kernel, or a truncated buffer', () => {
    expect(laplacianVariance(new Uint8Array(4), 2, 2)).toBe(0);
    expect(laplacianVariance(new Uint8Array(W * 4), W, H)).toBe(0);
  });
});

describe('centreCrop', () => {
  it('takes a centred square of half the shorter side', () => {
    expect(centreCrop(640, 480)).toEqual({ sx: 200, sy: 120, sw: 240, sh: 240 });
    expect(centreCrop(480, 640)).toEqual({ sx: 120, sy: 200, sw: 240, sh: 240 });
  });

  it('stays inside the image', () => {
    const c = centreCrop(100, 100, 1);
    expect(c.sx).toBeGreaterThanOrEqual(0);
    expect(c.sy).toBeGreaterThanOrEqual(0);
    expect(c.sx + c.sw).toBeLessThanOrEqual(100);
    expect(c.sy + c.sh).toBeLessThanOrEqual(100);
  });
});

describe('isSelfieBlurry', () => {
  it('shows the notice only below the floor', () => {
    expect(isSelfieBlurry(SELFIE_SHARPNESS_FLOOR - 1)).toBe(true);
    expect(isSelfieBlurry(SELFIE_SHARPNESS_FLOOR)).toBe(false);
    expect(isSelfieBlurry(150)).toBe(false);
  });

  it('never calls an unmeasured selfie blurry', () => {
    // "We could not look" is not evidence the photo was soft, and asking for a
    // retake on no evidence would send away a photo that may be fine.
    expect(isSelfieBlurry(null)).toBe(false);
  });
});

describe('measureSelfieSharpness', () => {
  it('returns null rather than throwing where there is no canvas', async () => {
    await expect(measureSelfieSharpness('data:image/jpeg;base64,AAAA')).resolves.toBeNull();
  });
});
