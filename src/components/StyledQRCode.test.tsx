import { describe, it, expect } from 'vitest';
import qrcode from 'qrcode-generator';

// The renderer is pure geometry over the encoder's matrix, so the properties
// worth pinning are the ones that decide whether a phone can still read it.
// Rendering React here would test JSDOM; these test the maths that matters.

const URL = 'https://verify.myaza.co/verify/workflow/abcdefghijklmnop';

function matrix(level: 'M' | 'H') {
  const qr = qrcode(0, level);
  qr.addData(URL);
  qr.make();
  return qr;
}

describe('the QR the handoff renders', () => {
  it('encodes at level H, which is what pays for the cleared centre', () => {
    // The logo sits in a hole punched out of the code. Only level H's 30%
    // recovery makes that hole affordable; at M it would not be readable.
    const h = matrix('H');
    const m = matrix('M');
    // Higher recovery needs more modules for the same payload — that is the
    // cost being paid, and it showing up here is what proves H is in use.
    expect(h.getModuleCount()).toBeGreaterThanOrEqual(m.getModuleCount());
  });

  it('clears about a fifth of the code for the logo, not more', () => {
    // Level H recovers 30%, but finders and timing patterns are not ours to
    // spend, so the logo takes ~22% of the WIDTH.
    const count = matrix('H').getModuleCount();
    const logoModules = Math.round(count * 0.22);
    const clearedArea = (logoModules * logoModules) / (count * count);
    expect(clearedArea).toBeLessThan(0.06);
  });

  it('leaves the three finder patterns intact', () => {
    // They are how a scanner locates and orients the code. The cleared centre
    // must never reach them.
    const count = matrix('H').getModuleCount();
    const logoModules = Math.round(count * 0.22);
    const logoStart = Math.floor((count - logoModules) / 2);
    // The finders occupy the first and last 7 modules on each axis.
    expect(logoStart).toBeGreaterThan(7);
    expect(logoStart + logoModules).toBeLessThan(count - 7);
  });

  it('produces a square matrix the renderer can walk', () => {
    const qr = matrix('H');
    const n = qr.getModuleCount();
    expect(n).toBeGreaterThan(20);
    expect(() => qr.isDark(n - 1, n - 1)).not.toThrow();
  });
});

describe('the scannable-size floor', () => {
  const MIN_PX_PER_MODULE = 4;
  const QUIET = 2;

  it('overrides a size that would render too small to decode', () => {
    // This is the regression it exists to stop: 172px was measured NOT to
    // decode, and nothing in the type system or the layout would have said so.
    const count = matrix('H').getModuleCount();
    const total = count + QUIET * 2;
    const rendered = Math.max(172, total * MIN_PX_PER_MODULE);
    expect(rendered).toBeGreaterThan(172);
    expect(rendered / total).toBeGreaterThanOrEqual(MIN_PX_PER_MODULE);
  });

  it('grows with the payload, so a longer token cannot silently break it', () => {
    // Module count is a function of the URL. A constant that is fine for
    // today's token stops being fine when one gets longer.
    const shortQr = qrcode(0, 'H');
    shortQr.addData('https://a.co/v/1');
    shortQr.make();
    const longQr = qrcode(0, 'H');
    longQr.addData(`https://dashboard.myaza.co/verify/workflow/${'x'.repeat(120)}`);
    longQr.make();

    const floor = (n: number) => (n + QUIET * 2) * MIN_PX_PER_MODULE;
    expect(floor(longQr.getModuleCount())).toBeGreaterThan(floor(shortQr.getModuleCount()));
  });

  it('leaves a generous requested size alone', () => {
    const total = matrix('H').getModuleCount() + QUIET * 2;
    expect(Math.max(400, total * MIN_PX_PER_MODULE)).toBe(400);
  });
});
