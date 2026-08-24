import { describe, it, expect } from 'vitest';
import { MYAZA_QR_LOGO } from './qr-logo';

const svg = () => decodeURIComponent(MYAZA_QR_LOGO.replace('data:image/svg+xml,', ''));

describe('MYAZA_QR_LOGO', () => {
  it('is inline, so it cannot fail behind a CSP or leak a request', () => {
    // The SDK ships into other people's pages. An <img src> pointing at a host
    // would be a network call at the exact moment the user is deciding whether
    // to trust us, and would simply not render under a strict CSP.
    expect(MYAZA_QR_LOGO.startsWith('data:image/svg+xml,')).toBe(true);
    expect(MYAZA_QR_LOGO).not.toMatch(/https?:\/\//);
  });

  it('carries the ring that separates the tile from the dots', () => {
    // Without it the tile bleeds into the surrounding modules and stops reading
    // as an overlay.
    const s = svg();
    expect(s).toContain('#FFFFFF');
    expect(s.match(/<rect/g)?.length).toBe(2);
  });

  it('reverses the mark for a saturated ground', () => {
    // The mark's own indigo body is illegible on the brand gradient at 40px.
    const s = svg();
    expect(s).toContain('linearGradient');
    expect(s).not.toContain('#19156F');
  });

  it('drops the outer blob and keeps the glyph', () => {
    // At ~40px the faint outer shape muddied the mark rather than framing it,
    // so what is left is the glyph alone: two paths, not the wordmark's three.
    expect(svg().match(/<path/g)?.length).toBe(2);
  });

  it('scales the glyph to fill the tile', () => {
    // Rendered at its native size inside the tile it read as a speck, which was
    // the whole complaint.
    expect(svg()).toMatch(/scale\(1\.\d+\)/);
  });
});
