import { describe, it, expect } from 'vitest';
import { documentCropRect, documentGuideRect } from './document-guide';

// A landscape sensor frame inside a tall portrait phone viewport — the case the
// shutter got wrong: object-cover shows a narrow slice, so storing the whole
// frame handed back a much wider photo than the user framed.
const FRAME = { width: 1920, height: 1080 };
const PHONE = { width: 390, height: 780 };
const CARD = 1.586;

describe('documentCropRect', () => {
  it('returns null when the frame has no dimensions yet', () => {
    expect(
      documentCropRect({
        frame: { width: 0, height: 0 },
        view: PHONE,
        aspect: CARD,
      }),
    ).toBeNull();
  });

  it('returns null when the viewport has not been laid out', () => {
    expect(
      documentCropRect({
        frame: FRAME,
        view: { width: 0, height: 0 },
        aspect: CARD,
      }),
    ).toBeNull();
  });

  it('crops well inside the frame rather than keeping all of it', () => {
    const crop = documentCropRect({ frame: FRAME, view: PHONE, aspect: CARD })!;
    expect(crop.width).toBeLessThan(FRAME.width);
    expect(crop.height).toBeLessThan(FRAME.height);
    expect(crop.x).toBeGreaterThan(0);
  });

  it('stays within the frame on every edge', () => {
    const crop = documentCropRect({ frame: FRAME, view: PHONE, aspect: CARD })!;
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(FRAME.width);
    expect(crop.y + crop.height).toBeLessThanOrEqual(FRAME.height);
  });

  it('preserves the document aspect, so the stored photo is not stretched', () => {
    const crop = documentCropRect({ frame: FRAME, view: PHONE, aspect: CARD })!;
    expect(crop.width / crop.height).toBeCloseTo(CARD, 1);
  });

  it('keeps a passport crop taller than a card crop at the same width', () => {
    const card = documentCropRect({ frame: FRAME, view: PHONE, aspect: CARD })!;
    const passport = documentCropRect({
      frame: FRAME,
      view: PHONE,
      aspect: 1.42,
    })!;
    // The MRZ band lives at the bottom of a passport page: a squarer guide must
    // take a taller region or the crop cuts it off.
    expect(passport.height / passport.width).toBeGreaterThan(
      card.height / card.width,
    );
  });

  it('is horizontally centred on the frame', () => {
    const crop = documentCropRect({ frame: FRAME, view: PHONE, aspect: CARD })!;
    const leftGap = crop.x;
    const rightGap = FRAME.width - (crop.x + crop.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
  });

  it('maps the guide back through the same cover transform the overlay used', () => {
    // Independent re-derivation: scale the guide by the cover factor and offset
    // by the overflow. If the crop ever stops agreeing with this, the user is
    // framing against one rectangle and receiving another.
    const f = Math.max(
      PHONE.width / FRAME.width,
      PHONE.height / FRAME.height,
    );
    const guide = documentGuideRect(PHONE, CARD);
    const expectedX = (guide.x + (FRAME.width * f - PHONE.width) / 2) / f;
    const expectedY = (guide.y + (FRAME.height * f - PHONE.height) / 2) / f;

    const crop = documentCropRect({ frame: FRAME, view: PHONE, aspect: CARD })!;
    expect(crop.x).toBeCloseTo(expectedX, 0);
    expect(crop.y).toBeCloseTo(expectedY, 0);
    expect(crop.width).toBeCloseTo(guide.width / f, 0);
  });

  it('handles a portrait frame in a portrait viewport', () => {
    const crop = documentCropRect({
      frame: { width: 1080, height: 1920 },
      view: PHONE,
      aspect: CARD,
    })!;
    expect(crop.width).toBeGreaterThan(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1080);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1920);
  });

  it('crops the inline desktop box, which is landscape, not portrait', () => {
    // The desktop viewfinder is a 16:10 box showing a 16:9 webcam frame with
    // object-cover. It now paints the SAME guide as the phone, so one crop has
    // to hold for both orientations.
    const crop = documentCropRect({
      frame: { width: 1280, height: 720 },
      view: { width: 640, height: 400 },
      aspect: CARD,
    })!;
    expect(crop.width).toBeLessThan(1280);
    expect(crop.x).toBeGreaterThan(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1280);
    expect(crop.y + crop.height).toBeLessThanOrEqual(720);
    expect(crop.width / crop.height).toBeCloseTo(CARD, 1);
  });

  it('keeps the guide inside a wide, short viewport', () => {
    // Width-led sizing alone would overflow a landscape box; the height cap is
    // what keeps the guide inset. A guide taller than its viewfinder cannot be
    // framed against, and its crop would clamp to the frame edge.
    const view = { width: 1200, height: 500 };
    const guide = documentGuideRect(view, 1.42);
    expect(guide.height).toBeLessThanOrEqual(view.height);
    expect(guide.width).toBeLessThanOrEqual(view.width);
    expect(guide.y).toBeGreaterThanOrEqual(0);
  });

  it('never returns a zero-area crop on a tiny viewport', () => {
    const crop = documentCropRect({
      frame: FRAME,
      view: { width: 8, height: 8 },
      aspect: CARD,
    })!;
    expect(crop.width).toBeGreaterThanOrEqual(1);
    expect(crop.height).toBeGreaterThanOrEqual(1);
  });
});
