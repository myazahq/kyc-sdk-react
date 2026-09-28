/**
 * The colour the flash-liveness overlay paints, or null for no overlay.
 *
 * The flash check measures the face's reflection of each colour against a
 * NEUTRAL baseline sampled between colours (runFlashSequence calls
 * `setColor(null)` for it), and assumes each colour ADDS light relative to
 * that baseline. Showing the ordinary step UI for the baseline broke that as
 * soon as the UI could be white (bright screen during the selfie): a colour
 * then REMOVES light and the reflection shift points the wrong way. So while
 * the sequence runs, a null colour paints BLACK on the same overlay, with the
 * same see-your-face hole, which keeps the baseline dark whatever the theme.
 *
 * Outside the sequence (positioning, gestures, the review) there is no overlay.
 */
export const FLASH_BASELINE_COLOR = '#000000';

export function flashOverlayColor(flashing: boolean, flashColor: string | null): string | null {
  if (flashColor) return flashColor;
  return flashing ? FLASH_BASELINE_COLOR : null;
}
