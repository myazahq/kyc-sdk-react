// ---------------------------------------------------------------------------
// Head + face gesture detection from MediaPipe Face Mesh landmarks.
// (Blink lives in ./blink.ts — it needs its own per-session state.)
// ---------------------------------------------------------------------------

import type { NormalizedLandmark } from '../types';
import { L, average, distance } from './landmarks';

// ---------------------------------------------------------------------------
// Nod Detection
// Track nose tip Y position over a sliding window of ~20 frames.
// Nod = nose Y drops below baseline, then returns.
// ---------------------------------------------------------------------------

export function detectNod(landmarks: NormalizedLandmark[], history: number[]): boolean {
  const noseY = landmarks[L.noseTip].y;
  history.push(noseY);
  if (history.length > 20) history.shift();

  if (history.length < 12) return false;

  const baseline = average(history.slice(0, 10));
  const recentWindow = history.slice(10);
  const minY = Math.min(...recentWindow);
  const maxY = Math.max(...recentWindow);

  // Nose moved down then back up significantly
  return (maxY - minY) > 0.03 && Math.abs(noseY - baseline) < 0.01;
}

// ---------------------------------------------------------------------------
// Head Turn Detection (left/right)
// Compare nose tip X to midpoint between left and right cheeks.
// ---------------------------------------------------------------------------

export function detectHeadTurn(
  landmarks: NormalizedLandmark[],
): 'left' | 'right' | 'center' {
  const noseX = landmarks[L.noseTip].x;
  const leftCheekX = landmarks[L.leftCheek].x;
  const rightCheekX = landmarks[L.rightCheek].x;
  const faceCenterX = (leftCheekX + rightCheekX) / 2;
  const faceWidth = Math.abs(rightCheekX - leftCheekX);

  const offset = (noseX - faceCenterX) / faceWidth;

  if (offset < -0.15) return 'left';
  if (offset > 0.15) return 'right';
  return 'center';
}

// ---------------------------------------------------------------------------
// Smile Detection
// Smile = mouth width increases relative to face width. Both spans are
// x-dominant, so the frame's aspect distortion cancels out of the ratio.
// ---------------------------------------------------------------------------

export function detectSmile(landmarks: NormalizedLandmark[]): boolean {
  const mouthWidth = distance(landmarks[L.mouthLeft], landmarks[L.mouthRight]);
  const faceWidth = distance(landmarks[L.leftCheek], landmarks[L.rightCheek]);

  if (faceWidth === 0) return false;
  const ratio = mouthWidth / faceWidth;
  return ratio > 0.42; // Neutral is ~0.35, smile is ~0.42+
}

// ---------------------------------------------------------------------------
// Open Mouth Detection
// Mouth openness = vertical distance between lips / face height. Both spans
// are y-dominant, so the aspect distortion cancels out of the ratio.
// ---------------------------------------------------------------------------

export function detectOpenMouth(landmarks: NormalizedLandmark[]): boolean {
  const mouthHeight = distance(landmarks[L.upperLipTop], landmarks[L.lowerLipBottom]);
  const faceHeight = distance(landmarks[L.forehead], landmarks[L.chin]);

  if (faceHeight === 0) return false;
  const ratio = mouthHeight / faceHeight;
  return ratio > 0.08; // Neutral is ~0.02, open is ~0.08+
}
