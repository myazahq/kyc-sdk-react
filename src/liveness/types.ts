// ---------------------------------------------------------------------------
// Liveness challenge types & configuration
// ---------------------------------------------------------------------------

export type LivenessChallenge =
  | 'nod'
  | 'turn'
  | 'blink'
  | 'smile'
  | 'flash';

/** How Presence Intelligence verifies liveness. Configured per workflow. */
export type LivenessMode = 'gestures' | 'flash' | 'both';

export interface ChallengeConfig {
  type: LivenessChallenge;
  instruction: string;
  icon: string;
  avatarAnimation: string;
  timeoutSeconds: number;
  detectionThreshold: number;
}

export const CHALLENGE_POOL: ChallengeConfig[] = [
  {
    type: 'nod',
    instruction: 'Kindly nod your head',
    icon: '↕️',
    avatarAnimation: 'animate-avatar-nod',
    timeoutSeconds: 8,
    detectionThreshold: 0.6,
  },
  {
    type: 'turn',
    instruction: 'Kindly turn your head',
    icon: '↔️',
    avatarAnimation: 'animate-avatar-turn',
    timeoutSeconds: 8,
    detectionThreshold: 0.55,
  },
  {
    type: 'blink',
    instruction: 'Kindly blink your eyes',
    icon: '😉',
    avatarAnimation: 'animate-avatar-blink',
    timeoutSeconds: 6,
    detectionThreshold: 0.5,
  },
  {
    type: 'smile',
    instruction: 'Kindly smile',
    icon: '😊',
    avatarAnimation: 'animate-avatar-smile',
    timeoutSeconds: 6,
    detectionThreshold: 0.6,
  },
];

/**
 * Screen-reflection (flash) challenge — appended as the FINAL challenge when
 * the liveness mode includes flash; never part of the random gesture pool.
 * The screen emits a random color sequence and the face's reflected hue shift
 * is verified against it (see flash-detector.ts).
 */
export const FLASH_CHALLENGE: ChallengeConfig = {
  type: 'flash',
  instruction: 'Hold still',
  icon: '✨',
  avatarAnimation: '',
  timeoutSeconds: 12,
  detectionThreshold: 0.5,
};

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type LivenessPhase =
  | 'loading'
  | 'positioning'
  | 'challenge'
  | 'challenge_passed'
  | 'capturing'
  | 'complete'
  | 'failed';

export type LivenessState =
  | { phase: 'loading' }
  | { phase: 'positioning'; guidance: string }
  | { phase: 'challenge'; index: number; challenge: ChallengeConfig; timeRemaining: number; warning?: string }
  | { phase: 'challenge_passed'; index: number }
  | { phase: 'capturing'; guidance?: string }
  | { phase: 'complete'; selfieBase64: string }
  | { phase: 'failed'; reason: 'timeout' | 'face_lost' | 'no_camera' | 'load_error' | 'flash_failed' | 'face_swap' };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LivenessConfig {
  challengeCount: 2 | 3;
  challengePool?: LivenessChallenge[];
  timeoutPerChallenge: number;
  enableAvatar: boolean;
  positioningTimeout: number;
  /** gestures (default) | flash (screen-reflection only) | both (gestures + flash). */
  mode: LivenessMode;
  /** Flash sequence length (colours). Undefined ⇒ the generator default (4). */
  flashSequenceLength?: number;
}

export const DEFAULT_LIVENESS_CONFIG: LivenessConfig = {
  challengeCount: 2,
  timeoutPerChallenge: 8,
  enableAvatar: true,
  positioningTimeout: 15,
  mode: 'gestures',
};

// ---------------------------------------------------------------------------
// MediaPipe Face Mesh landmark type
// ---------------------------------------------------------------------------

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}
