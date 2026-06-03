// ---------------------------------------------------------------------------
// Liveness challenge types & configuration
// ---------------------------------------------------------------------------

export type LivenessChallenge =
  | 'nod'
  | 'turn'
  | 'blink'
  | 'smile';

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
  | { phase: 'capturing' }
  | { phase: 'complete'; selfieBase64: string }
  | { phase: 'failed'; reason: 'timeout' | 'face_lost' | 'no_camera' | 'load_error' };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LivenessConfig {
  challengeCount: 2 | 3;
  challengePool?: LivenessChallenge[];
  timeoutPerChallenge: number;
  enableAvatar: boolean;
  positioningTimeout: number;
}

export const DEFAULT_LIVENESS_CONFIG: LivenessConfig = {
  challengeCount: 2,
  timeoutPerChallenge: 8,
  enableAvatar: true,
  positioningTimeout: 15,
};

// ---------------------------------------------------------------------------
// MediaPipe Face Mesh landmark type
// ---------------------------------------------------------------------------

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}
