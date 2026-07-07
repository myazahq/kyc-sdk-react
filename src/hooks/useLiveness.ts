'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createFaceMesh, type FaceMeshHandle } from '../liveness/face-mesh';
import { pickChallenges, ChallengeTracker, type ChallengeEntry } from '../liveness/challenge-manager';
import {
  detectNod,
  detectHeadTurn,
  detectBlink,
  detectSmile,
  checkFacePosition,
} from '../liveness/gesture-detector';
import type {
  LivenessState,
  LivenessConfig,
  NormalizedLandmark,
} from '../liveness/types';
import { runFlashSequence } from '../liveness/flash-detector';
import { recordLivenessSignals } from '../lib/integrity-signals';
import { speak, stopSpeaking } from '../liveness/speech';
import type { LightLevel } from './useLightLevel';
import {
  CAPTURE_FRAMERATE,
  LIVENESS_VIDEO_BITRATE,
  createVideoRecorder,
  logCaptureSize,
} from '../lib/capture-settings';

// User-facing guidance shown (and spoken) when a second face enters the frame.
const MULTI_FACE_GUIDANCE = 'Make sure only your face is visible';
// Sentinel stored in `warning` during a challenge when >1 face is present.
const MULTI_FACE_WARNING = 'multiple_faces';

function lightingGuidance(level: LightLevel): string | null {
  if (level === 'dark') return 'Move to a brighter area';
  if (level === 'bright') return 'Too bright — reduce glare';
  return null;
}

// ---------------------------------------------------------------------------
// Public return type
// ---------------------------------------------------------------------------

export interface UseLivenessReturn {
  state: LivenessState;
  challenges: readonly ChallengeEntry[];
  isFaceDetected: boolean;
  /** Short video blob recorded during the liveness session */
  videoBlob: Blob | null;
  /**
   * CSS color for the fullscreen flash overlay while the screen-reflection
   * challenge runs; null when no flash is being shown.
   */
  flashColor: string | null;
  retry: () => void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseLivenessOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraReady: boolean;
  config?: Partial<LivenessConfig>;
  captureFrame: () => string | null;
  compressImage: (base64: string) => Promise<string>;
  /**
   * Current lighting quality. When not `'ok'` the flow discourages capture —
   * it won't start the first challenge or auto-capture the selfie, and shows
   * lighting guidance instead. Defaults to `'ok'` when omitted.
   */
  lightLevel?: LightLevel;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useLiveness({
  videoRef,
  cameraReady,
  config,
  captureFrame,
  compressImage,
  lightLevel = 'ok',
}: UseLivenessOptions): UseLivenessReturn {
  const [state, setState] = useState<LivenessState>({ phase: 'loading' });
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [challenges, setChallenges] = useState<readonly ChallengeEntry[]>([]);
  // Incremented by retry() to re-trigger the FaceMesh initialization effect
  const [retryCount, setRetryCount] = useState(0);

  // Use a ref for phase so the Face Mesh callback always reads the latest value
  const phaseRef = useRef<LivenessState['phase']>('loading');

  const faceMeshRef = useRef<FaceMeshHandle | null>(null);
  const trackerRef = useRef<ChallengeTracker | null>(null);
  const rafRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const processingRef = useRef(false);

  // Gesture detection history buffers
  const nodHistoryRef = useRef<number[]>([]);
  const blinkHistoryRef = useRef<number[]>([]);
  const positionStableRef = useRef<number>(0);

  // Cooldown: skip detection for N frames after a new challenge starts
  // This prevents the next gesture from passing on residual face state
  // (e.g. still smiling, head still turned) from the previous gesture.
  const cooldownFramesRef = useRef<number>(0);

  // Challenge timeout
  const challengeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flash (screen-reflection) challenge
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const flashSessionRef = useRef(0); // bumped on retry/unmount to abort a running sequence
  const flashRunningRef = useRef(false);

  // Face-continuity guard: a real face can't teleport between consecutive
  // frames — landmark jumps (position/scale) flag face swaps & spliced feeds.
  const prevFaceSigRef = useRef<{ x: number; y: number; iod: number } | null>(null);
  const faceGlitchesRef = useRef(0);

  // Video recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

  // Keep captureFrame and compressImage in refs so callbacks don't go stale
  const captureFrameRef = useRef(captureFrame);
  captureFrameRef.current = captureFrame;
  const compressImageRef = useRef(compressImage);
  compressImageRef.current = compressImage;

  // Live lighting quality, read inside the Face Mesh callback.
  const lightLevelRef = useRef(lightLevel);
  lightLevelRef.current = lightLevel;

  // True while a challenge is paused because >1 face is in frame — used to
  // restart the challenge timer when the frame returns to a single face.
  const multiFacePausedRef = useRef(false);

  // -----------------------------------------------------------------------
  // Helper: update state and phase ref together
  // -----------------------------------------------------------------------

  // Track the last spoken text to avoid repeating the same guidance
  const lastSpokenRef = useRef<string>('');

  const setPhase = useCallback((next: LivenessState) => {
    phaseRef.current = next.phase;
    setState(next);

    // Trigger speech for key transitions
    let textToSpeak = '';
    switch (next.phase) {
      case 'positioning':
        textToSpeak = next.guidance;
        break;
      case 'challenge':
        if (next.warning === MULTI_FACE_WARNING) {
          textToSpeak = MULTI_FACE_GUIDANCE;
        } else if (next.warning && next.warning !== 'wrong_gesture') {
          textToSpeak = next.warning;
        } else if (!next.warning) {
          textToSpeak = next.challenge.instruction;
        }
        break;
      case 'capturing':
        textToSpeak = 'Kindly hold still';
        break;
      case 'challenge_passed':
        textToSpeak = 'Great!';
        break;
      case 'complete':
        textToSpeak = 'Liveness verified!';
        break;
      case 'failed':
        if (next.reason === 'timeout') textToSpeak = "Time's up. Let's try again.";
        else if (next.reason === 'face_lost') textToSpeak = 'Face lost. Please try again.';
        break;
    }

    if (textToSpeak && textToSpeak !== lastSpokenRef.current) {
      lastSpokenRef.current = textToSpeak;
      speak(textToSpeak);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Initialize: pick challenges
  // -----------------------------------------------------------------------

  const initTracker = useCallback(() => {
    const picked = pickChallenges(config);
    const tracker = new ChallengeTracker(picked);
    trackerRef.current = tracker;
    setChallenges([...tracker.all]);
    return tracker;
  }, [config]);

  // -----------------------------------------------------------------------
  // Video recording helpers
  // -----------------------------------------------------------------------

  const startRecording = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Get the stream from the video element
    const stream = (video as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }).captureStream?.(CAPTURE_FRAMERATE);
    if (!stream) return;

    const created = createVideoRecorder(stream, LIVENESS_VIDEO_BITRATE);
    if (!created) return; // Browser doesn't support recording
    const { recorder, mimeType } = created;
    recordedChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      if (recordedChunksRef.current.length > 0) {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        logCaptureSize('liveness video (capture-stream)', blob);
        setVideoBlob(blob);
      }
    };

    try {
      recorder.start(500); // collect chunks every 500ms
    } catch {
      return; // stream unusable — skip recording rather than crash
    }
    mediaRecorderRef.current = recorder;
  }, [videoRef]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  // -----------------------------------------------------------------------
  // Challenge timeout timer
  // -----------------------------------------------------------------------

  const clearChallengeTimer = useCallback(() => {
    if (challengeTimerRef.current) {
      clearTimeout(challengeTimerRef.current);
      challengeTimerRef.current = null;
    }
  }, []);

  const startChallengeTimer = useCallback(
    (seconds: number) => {
      clearChallengeTimer();
      challengeTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        stopRecording();
        setPhase({ phase: 'failed', reason: 'timeout' });
      }, seconds * 1000);
    },
    [clearChallengeTimer, setPhase, stopRecording],
  );

  // -----------------------------------------------------------------------
  // Auto-capture selfie
  // -----------------------------------------------------------------------

  const doCapture = useCallback(async () => {
    stopRecording();

    const base64 = captureFrameRef.current();
    if (!base64) {
      setPhase({ phase: 'failed', reason: 'face_lost' });
      return;
    }

    const compressed = await compressImageRef.current(base64);
    if (!mountedRef.current) return;

    logCaptureSize('selfie still', compressed);
    setPhase({ phase: 'complete', selfieBase64: compressed });
  }, [setPhase, stopRecording]);

  // -----------------------------------------------------------------------
  // Process a frame of landmarks
  // This is stored in a ref so the Face Mesh onResults callback
  // always calls the latest version without needing to re-create it.
  // -----------------------------------------------------------------------

  const processLandmarksRef = useRef<(landmarks: NormalizedLandmark[] | null, faceCount: number) => void>(() => {});

  // Shared "current challenge passed" path — used by gesture detection AND the
  // flash-sequence completion. Advances to the next challenge or capture.
  const passCurrentChallenge = () => {
    const tracker = trackerRef.current;
    if (!tracker?.current) return;
    clearChallengeTimer();
    tracker.markCurrentPassed();
    setChallenges([...tracker.all]);
    setPhase({ phase: 'challenge_passed', index: tracker.currentIndex });

    // After a delay (800ms flash + 1000ms cooldown), advance to next challenge or capture
    setTimeout(() => {
      if (!mountedRef.current) return;

      // Reset detection buffers for next challenge
      nodHistoryRef.current = [];
      blinkHistoryRef.current = [];
      prevFaceSigRef.current = null;

      const hasMore = tracker.advance();
      setChallenges([...tracker.all]);

      if (hasMore) {
        const next = tracker.current!;
        // 30 frames (~1s) cooldown so residual face state doesn't
        // instantly pass the next gesture
        cooldownFramesRef.current = 30;
        setPhase({
          phase: 'challenge',
          index: tracker.currentIndex,
          challenge: next.config,
          timeRemaining: next.config.timeoutSeconds,
        });
        startChallengeTimer(next.config.timeoutSeconds);
        maybeStartFlash();
      } else {
        // All challenges passed — wait for steady face then capture
        positionStableRef.current = 0;
        setPhase({ phase: 'capturing' });
      }
    }, 1800);
  };

  // Start the flash (screen-reflection) sequence when the ACTIVE challenge is
  // the flash challenge. Runs on its own timeline (not landmark-driven); the
  // challenge timeout still applies as the outer deadline.
  const maybeStartFlash = () => {
    const tracker = trackerRef.current;
    const entry = tracker?.current;
    const video = videoRef.current;
    if (!entry || entry.config.type !== 'flash' || flashRunningRef.current || !video) return;

    flashRunningRef.current = true;
    const session = flashSessionRef.current;
    const isActive = () =>
      mountedRef.current && flashSessionRef.current === session && phaseRef.current === 'challenge';

    runFlashSequence(video, setFlashColor, isActive)
      .then((result) => {
        flashRunningRef.current = false;
        recordLivenessSignals({
          mode: config?.mode ?? 'gestures',
          flash: {
            passed: result.passed,
            score: result.score,
            matched: result.matched,
            total: result.total,
            inconclusive: result.inconclusive,
            sequence: result.sequence,
          },
        });
        if (!isActive()) return;
        if (result.passed) {
          passCurrentChallenge();
        } else {
          clearChallengeTimer();
          stopRecording();
          trackerRef.current?.markCurrentFailed();
          setChallenges([...(trackerRef.current?.all ?? [])]);
          setPhase({ phase: 'failed', reason: 'flash_failed' });
        }
      })
      .catch(() => {
        flashRunningRef.current = false;
        setFlashColor(null);
      });
  };

  processLandmarksRef.current = (landmarks: NormalizedLandmark[] | null, faceCount: number) => {
    if (!mountedRef.current) return;

    const tracker = trackerRef.current;
    const phase = phaseRef.current;

    // No face detected
    if (!landmarks) {
      setIsFaceDetected(false);
      // Only reset position stability during positioning
      if (phase === 'positioning' || phase === 'loading') {
        positionStableRef.current = 0;
      }
      return;
    }

    setIsFaceDetected(true);

    // --- Multiple faces: pause and ask for a single face -------------------
    // More than one face is both a quality and a spoofing concern, so we never
    // run detection or auto-capture while a second person is in frame.
    if (faceCount > 1) {
      if (phase === 'loading' || phase === 'positioning') {
        positionStableRef.current = 0;
        setPhase({ phase: 'positioning', guidance: MULTI_FACE_GUIDANCE });
      } else if (phase === 'challenge' && tracker?.current) {
        // Pause the challenge timer so a second face can't run out the clock.
        if (!multiFacePausedRef.current) {
          multiFacePausedRef.current = true;
          clearChallengeTimer();
        }
        setPhase({
          phase: 'challenge',
          index: tracker.currentIndex,
          challenge: tracker.current.config,
          timeRemaining: tracker.current.config.timeoutSeconds,
          warning: MULTI_FACE_WARNING,
        });
      } else if (phase === 'capturing') {
        positionStableRef.current = 0;
      }
      return;
    }

    // Single face again — resume a paused challenge by restarting its timer.
    if (multiFacePausedRef.current) {
      multiFacePausedRef.current = false;
      if (phase === 'challenge' && tracker?.current) {
        cooldownFramesRef.current = 15; // brief grace so the face re-settles
        startChallengeTimer(tracker.current.config.timeoutSeconds);
      }
    }

    // --- Positioning phase: check face is centered and stable ---
    if (phase === 'loading' || phase === 'positioning') {
      // Block starting challenges in poor light — guide the user to fix it.
      const light = lightingGuidance(lightLevelRef.current);
      if (light) {
        positionStableRef.current = Math.max(0, positionStableRef.current - 5);
        setPhase({ phase: 'positioning', guidance: light });
        return;
      }

      const pos = checkFacePosition(landmarks);

      if (pos.isCentered && pos.isCorrectDistance) {
        positionStableRef.current++;
        // Need ~25 stable frames (~0.8s at 30fps)
        if (positionStableRef.current > 25 && tracker) {
          const current = tracker.current;
          if (current) {
            // Start recording when first challenge begins
            startRecording();
            cooldownFramesRef.current = 15; // ~0.5s grace period
            setPhase({
              phase: 'challenge',
              index: tracker.currentIndex,
              challenge: current.config,
              timeRemaining: current.config.timeoutSeconds,
            });
            setChallenges([...tracker.all]);
            startChallengeTimer(current.config.timeoutSeconds);
            maybeStartFlash(); // flash-only mode: the first challenge IS the flash
          }
        } else {
          setPhase({ phase: 'positioning', guidance: 'Kindly hold still' });
        }
      } else {
        // Decrease instead of resetting to 0 — brief wobbles don't lose all progress
        positionStableRef.current = Math.max(0, positionStableRef.current - 5);
        setPhase({
          phase: 'positioning',
          guidance: pos.guidance ?? 'Kindly position your face in the circle',
        });
      }
      return;
    }

    // --- Challenge phase: gesture detection + position monitoring ---
    if (phase === 'challenge' && tracker) {
      const current = tracker.current;
      if (!current) return;

      // Flash challenge runs on its own timeline (maybeStartFlash) — no
      // gesture detection, and no position warnings while the overlay covers
      // the screen. The face-continuity guard below is also skipped: the
      // color flashes legitimately disturb the landmark tracking.
      if (current.config.type === 'flash') return;

      // Face-continuity guard: consecutive-frame landmark jumps (face center
      // teleporting / face size snapping) are physically impossible for a live
      // face and typical of face swaps or spliced feeds. Three strikes fails.
      const nose = landmarks[1];
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      if (nose && leftEye && rightEye && cooldownFramesRef.current === 0) {
        const iod = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
        const prev = prevFaceSigRef.current;
        if (prev && iod > 0 && prev.iod > 0) {
          const jumped =
            Math.abs(nose.x - prev.x) > 0.18 ||
            Math.abs(nose.y - prev.y) > 0.18 ||
            iod / prev.iod > 1.5 ||
            iod / prev.iod < 0.66;
          if (jumped) {
            faceGlitchesRef.current++;
            recordLivenessSignals({
              mode: config?.mode ?? 'gestures',
              faceGlitches: faceGlitchesRef.current,
            });
            if (faceGlitchesRef.current >= 3) {
              clearChallengeTimer();
              stopRecording();
              setPhase({ phase: 'failed', reason: 'face_swap' });
              return;
            }
          }
        }
        prevFaceSigRef.current = { x: nose.x, y: nose.y, iod };
      }

      // Check if user has moved out of position
      const pos = checkFacePosition(landmarks);
      if (!pos.isCentered || !pos.isCorrectDistance) {
        setPhase({
          phase: 'challenge',
          index: tracker.currentIndex,
          challenge: current.config,
          timeRemaining: current.config.timeoutSeconds,
          warning: pos.guidance ?? 'Kindly come back to position',
        });
        return;
      }

      // Skip detection during cooldown period (user returning to neutral)
      if (cooldownFramesRef.current > 0) {
        cooldownFramesRef.current--;
        return;
      }

      let detected = false;

      // Detect wrong gestures for red-border feedback
      let wrongGesture = false;
      const expectedType = current.config.type;

      switch (expectedType) {
        case 'nod':
          detected = detectNod(landmarks, nodHistoryRef.current);
          if (!detected) {
            wrongGesture = detectHeadTurn(landmarks) !== 'center' || detectSmile(landmarks);
          }
          break;
        case 'turn':
          detected = detectHeadTurn(landmarks) !== 'center';
          break;
        case 'blink':
          detected = detectBlink(landmarks, blinkHistoryRef.current);
          if (!detected) {
            wrongGesture = detectSmile(landmarks) || detectHeadTurn(landmarks) !== 'center';
          }
          break;
        case 'smile':
          detected = detectSmile(landmarks);
          if (!detected) {
            wrongGesture = detectHeadTurn(landmarks) !== 'center';
          }
          break;
      }

      if (detected) {
        passCurrentChallenge();
      } else if (wrongGesture) {
        // Flash a warning for wrong gesture
        setPhase({
          phase: 'challenge',
          index: tracker.currentIndex,
          challenge: current.config,
          timeRemaining: current.config.timeoutSeconds,
          warning: 'wrong_gesture',
        });
      } else {
        // Clear any previous warning
        setPhase({
          phase: 'challenge',
          index: tracker.currentIndex,
          challenge: current.config,
          timeRemaining: current.config.timeoutSeconds,
        });
      }
    }

    // --- Capturing phase: wait for steady face before taking selfie ---
    if (phase === 'capturing') {
      // Don't auto-capture the selfie while lighting is poor.
      if (lightingGuidance(lightLevelRef.current)) {
        positionStableRef.current = 0;
        return;
      }
      const pos = checkFacePosition(landmarks);
      if (pos.isCentered && pos.isCorrectDistance) {
        positionStableRef.current++;
        // Need ~15 stable frames (~0.5s) for a clear photo
        if (positionStableRef.current > 15) {
          doCapture();
        }
      } else {
        positionStableRef.current = Math.max(0, positionStableRef.current - 3);
      }
    }
  };

  // -----------------------------------------------------------------------
  // rAF loop: send frames to Face Mesh
  // -----------------------------------------------------------------------

  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const mesh = faceMeshRef.current;

    if (!video || !mesh || !mountedRef.current) return;
    if (video.readyState < video.HAVE_CURRENT_DATA) {
      rafRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }

    if (!processingRef.current) {
      processingRef.current = true;
      mesh
        .send(video)
        .catch(() => {
          // Frame processing can fail occasionally — skip
        })
        .finally(() => {
          processingRef.current = false;
        });
    }

    rafRef.current = requestAnimationFrame(runDetectionLoop);
  }, [videoRef]);

  // -----------------------------------------------------------------------
  // Initialize Face Mesh immediately on mount / retry.
  // We deliberately do NOT gate this on cameraReady — if primeFaceMesh()
  // already finished, createFaceMesh() returns instantly so the user
  // never sees a face-mesh loading delay when the liveness step opens.
  // The detection loop only starts once BOTH conditions are met:
  //   1. face mesh is loaded  (tracked by faceMeshRef)
  //   2. camera is ready      (tracked by cameraReadyRef)
  // -----------------------------------------------------------------------

  const cameraReadyRef = useRef(false);

  // Starts the detection loop if both face mesh and camera are ready.
  // Guards against double-starts with rafRef.
  const beginDetection = useCallback(() => {
    if (!faceMeshRef.current || !cameraReadyRef.current || !mountedRef.current) return;
    if (rafRef.current !== 0) return; // loop already running
    setPhase({ phase: 'positioning', guidance: 'Kindly position your face in the circle' });
    runDetectionLoop();
  }, [runDetectionLoop, setPhase]);

  // Effect A — initialize face mesh as soon as possible (retryCount re-triggers on retry)
  useEffect(() => {
    let cancelled = false;

    initTracker();

    createFaceMesh((landmarks, faceCount) => {
      if (!cancelled) processLandmarksRef.current(landmarks, faceCount);
    })
      .then((handle) => {
        if (cancelled) { handle.close(); return; }
        faceMeshRef.current = handle;
        beginDetection(); // start immediately if camera is already open
      })
      .catch(() => {
        if (!cancelled) setPhase({ phase: 'failed', reason: 'load_error' });
      });

    return () => {
      cancelled = true;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      faceMeshRef.current?.close();
      faceMeshRef.current = null;
      clearChallengeTimer();
      flashSessionRef.current++; // abort any in-flight flash sequence
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  // Effect B — when camera becomes ready, start detection if mesh is already loaded
  useEffect(() => {
    cameraReadyRef.current = cameraReady;
    if (cameraReady) beginDetection();
  }, [cameraReady, beginDetection]);

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // -----------------------------------------------------------------------
  // Retry
  // -----------------------------------------------------------------------

  const retry = useCallback(() => {
    clearChallengeTimer();
    stopRecording();
    stopSpeaking();
    lastSpokenRef.current = '';
    setVideoBlob(null);
    nodHistoryRef.current = [];
    blinkHistoryRef.current = [];
    positionStableRef.current = 0;
    processingRef.current = false;
    cooldownFramesRef.current = 0;
    multiFacePausedRef.current = false;
    // Abort any in-flight flash sequence and clear the overlay + guards.
    flashSessionRef.current++;
    flashRunningRef.current = false;
    setFlashColor(null);
    prevFaceSigRef.current = null;
    faceGlitchesRef.current = 0;

    // Cancel and close any existing FaceMesh instance so the effect re-initialises cleanly
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    faceMeshRef.current?.close();
    faceMeshRef.current = null;

    initTracker();
    setPhase({ phase: 'loading' });
    // Bumping retryCount re-triggers the useEffect that loads FaceMesh
    setRetryCount((c) => c + 1);
  }, [clearChallengeTimer, stopRecording, initTracker, setPhase]);

  return {
    state,
    challenges,
    isFaceDetected,
    videoBlob,
    flashColor,
    retry,
  };
}
