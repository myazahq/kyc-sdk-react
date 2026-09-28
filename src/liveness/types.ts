// ---------------------------------------------------------------------------
// Liveness challenge types & configuration
// ---------------------------------------------------------------------------

// Straight from translate (not the i18n barrel): the barrel reaches the React
// context, which imports this module's types, and the pool below reads the
// defaults at load.
import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';

export type LivenessChallenge =
  | 'nod'
  | 'turn'
  | 'blink'
  | 'smile'
  | 'flash'
  // Passive Liveness: hold still and look at the camera; passes on its own
  // after a steady moment, and the server's model does the judging.
  | 'hold';

/** How Presence Intelligence verifies liveness. Configured per workflow. */
export type LivenessMode = 'gestures' | 'flash' | 'both' | 'passive';

/** The catalogue key of each challenge's instruction (shown AND spoken). */
export const CHALLENGE_TEXT_KEYS: Record<LivenessChallenge, string> = {
  nod: 'presence.challenge.nod',
  turn: 'presence.challenge.turn',
  blink: 'presence.challenge.blink',
  smile: 'presence.challenge.smile',
  flash: 'presence.challenge.flash',
  hold: 'presence.challenge.hold',
};

/** A challenge's instruction in the workflow's copy; the defaults without a `t`. */
export function challengeInstruction(type: LivenessChallenge, t: TextFn = defaultText): string {
  return t(CHALLENGE_TEXT_KEYS[type]);
}

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
    instruction: challengeInstruction('nod'),
    icon: '↕️',
    avatarAnimation: 'animate-avatar-nod',
    timeoutSeconds: 8,
    detectionThreshold: 0.6,
  },
  {
    type: 'turn',
    instruction: challengeInstruction('turn'),
    icon: '↔️',
    avatarAnimation: 'animate-avatar-turn',
    timeoutSeconds: 8,
    detectionThreshold: 0.55,
  },
  {
    type: 'blink',
    instruction: challengeInstruction('blink'),
    icon: '😉',
    avatarAnimation: 'animate-avatar-blink',
    timeoutSeconds: 6,
    detectionThreshold: 0.5,
  },
  {
    type: 'smile',
    instruction: challengeInstruction('smile'),
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
  instruction: challengeInstruction('flash'),
  icon: '✨',
  avatarAnimation: '',
  timeoutSeconds: 12,
  detectionThreshold: 0.5,
};

/**
 * Passive Liveness: the ONE prompt. The face holds still in the circle for
 * `HOLD_FRAMES`; the recording and the selfie go to the server, where the
 * liveness model decides. Never part of the random gesture pool.
 */
export const HOLD_CHALLENGE: ChallengeConfig = {
  type: 'hold',
  instruction: challengeInstruction('hold'),
  icon: '',
  avatarAnimation: '',
  timeoutSeconds: 10,
  detectionThreshold: 0,
};

/** About two seconds of a steady, centred face at 30 fps. */
export const HOLD_FRAMES = 60;

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
  /** gestures (default) | flash (screen-reflection only) | both (gestures + flash) | passive (hold still). */
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
