import { describe, expect, it } from 'vitest';
import {
  CAPTURE_CHECK_CONTINUE_ANYWAY,
  CAPTURE_CHECK_TITLE,
  captureCheckProblems,
  captureProblemMessage,
  captureProblemMessages,
  captureProblemSides,
  captureRetakeLabel,
} from './document-capture-check';

describe('captureCheckProblems', () => {
  it('asks only about what a detector looked for and did not find', () => {
    expect(
      captureCheckProblems([
        { side: 'back', face: null, barcode: false },
        { side: 'front', face: false, barcode: null },
      ]),
    ).toEqual([
      { side: 'front', kind: 'no_face' },
      { side: 'back', kind: 'no_barcode' },
    ]);
  });

  it('ignores answers that are fine, unchecked or missing', () => {
    expect(
      captureCheckProblems([{ side: 'front', face: true, barcode: null }, null, { side: 'back', face: null, barcode: true }]),
    ).toEqual([]);
  });
});

describe('copy', () => {
  it('says what to fix, mirrored word for word across the SDKs', () => {
    expect(captureProblemMessage('no_face')).toBe(
      "We couldn't see the face in the photo on the front of your ID. Retake it in good light, with the ID out of any plastic cover and no glare over the photo.",
    );
    expect(captureProblemMessage('no_barcode')).toBe(
      "We couldn't read the barcode on the back of your ID. Retake it with the ID out of any plastic cover, flat, filling the frame and with no glare over the barcode.",
    );
    expect(CAPTURE_CHECK_TITLE).toBe('Check your photos');
    expect(CAPTURE_CHECK_CONTINUE_ANYWAY).toBe('Continue anyway');
  });

  it('labels a retake by how the photo was taken', () => {
    expect(captureRetakeLabel('front', false)).toBe('Retake front');
    expect(captureRetakeLabel('back', true)).toBe('Replace back');
  });

  it('offers each side once and each message once', () => {
    const problems = [
      { side: 'front' as const, kind: 'no_barcode' as const },
      { side: 'back' as const, kind: 'no_barcode' as const },
    ];
    expect(captureProblemSides(problems)).toEqual(['front', 'back']);
    expect(captureProblemMessages(problems)).toHaveLength(1);
  });

  it('never uses an em dash', () => {
    const copy = [
      captureProblemMessage('no_face'),
      captureProblemMessage('no_barcode'),
      CAPTURE_CHECK_TITLE,
      CAPTURE_CHECK_CONTINUE_ANYWAY,
    ];
    for (const text of copy) expect(text).not.toContain('—');
  });
});
