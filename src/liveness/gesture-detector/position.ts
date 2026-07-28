// ---------------------------------------------------------------------------
// Face positioning check
// Returns guidance string or null if face is well positioned.
// ---------------------------------------------------------------------------

import type { NormalizedLandmark } from '../types';
import { L } from './landmarks';

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

  // Cheek-to-cheek span as a fraction of the frame width. 0.2 (the old floor)
  // let a clearly-distant face through without ever prompting; 0.28 requires
  // the face to fill enough of the circle for a usable selfie + flash reflection.
  const MIN_FACE_WIDTH = 0.28;
  const MAX_FACE_WIDTH = 0.7;
  const isCentered = Math.abs(noseX - 0.5) < 0.25 && Math.abs(noseY - 0.5) < 0.25;
  const isCorrectDistance = faceWidth > MIN_FACE_WIDTH && faceWidth < MAX_FACE_WIDTH;

  let guidance: string | null = null;
  if (faceWidth <= MIN_FACE_WIDTH) {
    // Distance first: a far face reads as "off-centre" too, but "move closer"
    // is the actionable instruction.
    guidance = 'Kindly move closer';
  } else if (!isCentered) {
    guidance = 'Kindly center your face';
  } else if (faceWidth >= MAX_FACE_WIDTH) {
    guidance = 'Kindly move further away';
  }

  return {
    isDetected: true,
    isCentered,
    isCorrectDistance,
    guidance,
  };
}
