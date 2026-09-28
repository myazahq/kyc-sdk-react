import { describe, expect, it } from 'vitest';
import { FLASH_BASELINE_COLOR, flashOverlayColor } from './flash-overlay';

describe('flashOverlayColor', () => {
  it('paints the flash colour while one is emitted', () => {
    expect(flashOverlayColor(true, '#ff2020')).toBe('#ff2020');
  });

  it('paints BLACK between colours while the sequence runs, so the baseline stays dark', () => {
    // The detector assumes each colour ADDS light over the baseline. With the
    // bright-screen light palette behind a clear overlay, a colour would
    // remove light instead and the check would read the reflection backwards.
    expect(flashOverlayColor(true, null)).toBe(FLASH_BASELINE_COLOR);
    expect(FLASH_BASELINE_COLOR).toBe('#000000');
  });

  it('shows no overlay outside the sequence (positioning, gestures, review)', () => {
    expect(flashOverlayColor(false, null)).toBeNull();
  });

  it('still paints a trailing colour after the sequence ends (never blanks mid-flash)', () => {
    expect(flashOverlayColor(false, '#2050ff')).toBe('#2050ff');
  });
});
