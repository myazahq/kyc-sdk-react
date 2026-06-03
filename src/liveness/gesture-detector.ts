// ---------------------------------------------------------------------------
// Gesture detection from MediaPipe Face Mesh landmarks (468 points)
// ---------------------------------------------------------------------------

import type { NormalizedLandmark } from './types';

// ---------------------------------------------------------------------------
// Key landmark indices
// ---------------------------------------------------------------------------

const L = {
  noseTip: 1,
  noseBase: 168,
  chin: 152,
  forehead: 10,
  leftCheek: 234,
  rightCheek: 454,

  // Left eye (6 points for EAR calculation)
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop1: 159,
  leftEyeTop2: 145,
  leftEyeBottom1: 153,
  leftEyeBottom2: 144,

  // Right eye
  rightEyeOuter: 362,
  rightEyeInner: 263,
  rightEyeTop1: 386,
  rightEyeTop2: 374,
  rightEyeBottom1: 380,
  rightEyeBottom2: 373,

  // Mouth
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  upperLipTop: 0,
  lowerLipBottom: 17,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

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
// Blink Detection (Eye Aspect Ratio)
// EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
// EAR drops below ~0.2 when eye is closed
// ---------------------------------------------------------------------------

function calculateEAR(landmarks: NormalizedLandmark[], eye: 'left' | 'right'): number {
  const pts =
    eye === 'left'
      ? [L.leftEyeOuter, L.leftEyeTop1, L.leftEyeTop2, L.leftEyeInner, L.leftEyeBottom1, L.leftEyeBottom2]
      : [L.rightEyeOuter, L.rightEyeTop1, L.rightEyeTop2, L.rightEyeInner, L.rightEyeBottom1, L.rightEyeBottom2];

  const p = pts.map((i) => landmarks[i]);

  const vertical1 = distance(p[1], p[5]);
  const vertical2 = distance(p[2], p[4]);
  const horizontal = distance(p[0], p[3]);

  if (horizontal === 0) return 1;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

export function detectBlink(landmarks: NormalizedLandmark[], history: number[]): boolean {
  const leftEAR = calculateEAR(landmarks, 'left');
  const rightEAR = calculateEAR(landmarks, 'right');
  const avgEAR = (leftEAR + rightEAR) / 2;

  history.push(avgEAR);
  if (history.length > 10) history.shift();

  // Blink = EAR drops below 0.2 then recovers above 0.25
  const hadClose = history.some((v) => v < 0.2);
  const recovered = avgEAR > 0.25;

  return hadClose && recovered;
}

// ---------------------------------------------------------------------------
// Smile Detection
// Smile = mouth width increases relative to face width
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
// Mouth openness = vertical distance between lips / face height
// ---------------------------------------------------------------------------

export function detectOpenMouth(landmarks: NormalizedLandmark[]): boolean {
  const mouthHeight = distance(landmarks[L.upperLipTop], landmarks[L.lowerLipBottom]);
  const faceHeight = distance(landmarks[L.forehead], landmarks[L.chin]);

  if (faceHeight === 0) return false;
  const ratio = mouthHeight / faceHeight;
  return ratio > 0.08; // Neutral is ~0.02, open is ~0.08+
}

// ---------------------------------------------------------------------------
// Face positioning check
// Returns guidance string or null if face is well positioned.
// ---------------------------------------------------------------------------

export interface FacePosition {
  isDetected: boolean;
  isCentered: boolean;
  isCorrectDistance: boolean;
  guidance: string | null;
}

export function checkFacePosition(landmarks: NormalizedLandmark[]): FacePosition {
  const noseX = landmarks[L.noseTip].x;
  const noseY = landmarks[L.noseTip].y;
  const faceWidth = Math.abs(landmarks[L.rightCheek].x - landmarks[L.leftCheek].x);

  const isCentered = Math.abs(noseX - 0.5) < 0.25 && Math.abs(noseY - 0.5) < 0.25;
  const isCorrectDistance = faceWidth > 0.2 && faceWidth < 0.7;

  let guidance: string | null = null;
  if (!isCentered) {
    guidance = 'Kindly center your face';
  } else if (faceWidth < 0.2) {
    guidance = 'Kindly move closer';
  } else if (faceWidth > 0.7) {
    guidance = 'Kindly move further away';
  }

  return {
    isDetected: true,
    isCentered,
    isCorrectDistance,
    guidance,
  };
}
