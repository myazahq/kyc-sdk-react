// ---------------------------------------------------------------------------
// Shared landmark indices + geometry helpers for gesture detection
// (MediaPipe Face Mesh, 468 points — 478 with refineLandmarks).
// ---------------------------------------------------------------------------

import type { NormalizedLandmark } from '../types';

export const L = {
  noseTip: 1,
  noseBase: 168,
  chin: 152,
  forehead: 10,
  leftCheek: 234,
  rightCheek: 454,

  // Mouth
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  upperLipTop: 0,
  lowerLipBottom: 17,
} as const;

/**
 * Distance between two landmarks.
 *
 * MediaPipe normalizes `x` by the frame WIDTH and `y` by the frame HEIGHT, so
 * normalized space is stretched whenever the frame isn't square. Pass
 * `aspect` (videoWidth / videoHeight) to measure in true image proportions —
 * required for any ratio that mixes the two axes (see `blink.ts`). Ratios that
 * stay on one axis (mouth width over face width, mouth height over face
 * height) cancel the distortion themselves and use the default.
 */
export function distance(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  aspect = 1,
): number {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}
