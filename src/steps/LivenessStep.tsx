'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { CameraPermissionPrimer } from '../components/CameraPermissionPrimer';
import { LivenessAvatar } from './LivenessAvatar';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { useCamera } from '../hooks/useCamera';
import { useCameraPrimer } from '../hooks/useCameraPrimer';
import { useImageCapture } from '../hooks/useImageCapture';
import { useImageCompress } from '../hooks/useImageCompress';
import { useLiveness } from '../hooks/useLiveness';
import { useLightLevel } from '../hooks/useLightLevel';
import { primeSpeech } from '../liveness/speech';
import { withRetry } from '../lib/retry';
import { mapToKycError, safeReportError } from '../lib/errors';
import { KYCError } from '../types/verification';
import { requiresDocumentCapture } from '../utils/countries';
import {
  LIVENESS_VIDEO_BITRATE,
  createVideoRecorder,
  logCaptureSize,
} from '../lib/capture-settings';
import type { ChallengeEntry } from '../liveness/challenge-manager';

// ---------------------------------------------------------------------------
// LivenessStep — active liveness check with gesture challenges
// ---------------------------------------------------------------------------

export function LivenessStep() {
  const { state: kycState, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const [preview, setPreview] = useState<string | null>(kycState.selfieImage);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; total: number } | null>(null);

  // Show an "Allow camera access" primer before the OS prompt (Stripe-style),
  // unless the camera is already granted. The camera only starts — and thus the
  // OS prompt only fires — once the user taps "Grant access".
  const primerStatus = useCameraPrimer();
  const [primed, setPrimed] = useState(false);
  const needsPrimer = primerStatus === 'needed' && !primed && !preview;

  const camera = useCamera({
    facingMode: 'user',
    enabled: !preview && (primerStatus === 'granted' || primed),
  });
  const { capture } = useImageCapture({ videoRef: camera.videoRef, mirror: true });
  const { compress, isCompressing } = useImageCompress();

  // Video recording refs
  const livenessRecorderRef = useRef<MediaRecorder | null>(null);
  const livenessChunksRef = useRef<Blob[]>([]);
  const livenessMimeRef = useRef('video/webm');

  const livenessActive = !preview && camera.isReady;
  const { level: lightLevel } = useLightLevel(camera.videoRef, livenessActive);
  const isDim = lightLevel === 'dark';
  const isBright = lightLevel === 'bright';

  const liveness = useLiveness({
    videoRef: camera.videoRef,
    cameraReady: camera.isReady && !preview,
    captureFrame: capture,
    compressImage: compress,
    lightLevel,
  });

  // Start/stop recorder with the camera stream
  React.useEffect(() => {
    if (!camera.stream || preview) return;
    // Guard against a stale stream whose tracks have already ended — starting a
    // MediaRecorder on it throws. The effect re-runs once a live stream arrives.
    if (!camera.stream.getVideoTracks().some((t) => t.readyState === 'live')) return;

    livenessChunksRef.current = [];
    const created = createVideoRecorder(camera.stream, LIVENESS_VIDEO_BITRATE);
    if (!created) return;
    const { recorder, mimeType } = created;
    livenessMimeRef.current = mimeType;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) livenessChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (livenessChunksRef.current.length > 0) {
        const blob = new Blob(livenessChunksRef.current, { type: livenessMimeRef.current });
        logCaptureSize('liveness video', blob);
        dispatch({
          type: 'SET_LIVENESS_VIDEO',
          payload: blob,
        });
        livenessChunksRef.current = [];
      }
    };
    try {
      recorder.start(200);
    } catch {
      // Stream became unusable between the live-track check and start() — skip
      // recording rather than crashing the liveness step.
      return;
    }
    livenessRecorderRef.current = recorder;

    return () => {
      // If the recorder was stopped manually (e.g. on capture complete), let
      // the original onstop handler dispatch the recorded blob — don't touch it.
      if (recorder.state === 'inactive') {
        if (livenessRecorderRef.current === recorder) livenessRecorderRef.current = null;
        return;
      }
      // Still recording: user navigated away or camera changed. Discard.
      livenessChunksRef.current = [];
      recorder.onstop = null;
      try { recorder.stop(); } catch { /* already stopped */ }
      if (livenessRecorderRef.current === recorder) livenessRecorderRef.current = null;
    };
  }, [camera.stream, preview, dispatch]);

  // Handle liveness complete — stop recorder and wait for the final chunk before
  // transitioning to preview, so the cleanup race doesn't drop the video.
  React.useEffect(() => {
    if (liveness.state.phase !== 'complete') return;
    const selfie = liveness.state.selfieBase64;

    let cancelled = false;

    (async () => {
      const r = livenessRecorderRef.current;
      livenessRecorderRef.current = null;

      if (r && r.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          // Wrap the existing onstop so the original dispatch still runs
          const originalOnStop = r.onstop;
          r.onstop = (ev) => {
            try {
              if (typeof originalOnStop === 'function') originalOnStop.call(r, ev);
            } finally {
              resolve();
            }
          };
          try {
            r.stop();
          } catch {
            resolve();
          }
        });
      }

      if (cancelled) return;

      setPreview(selfie);
      dispatch({ type: 'SET_SELFIE_IMAGE', payload: selfie });
      uploadSelfie(selfie);
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveness.state.phase]);

  async function uploadSelfie(selfieBase64: string) {
    setIsUploading(true);
    setUploadError(null);
    setRetryInfo(null);

    const api = config.api;

    try {
      const [header, data] = selfieBase64.split(',');
      const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });

      // Retried on transient failures (network / timeout / 5xx).
      const mediaId = await withRetry(() => api.upload(blob, 'selfie'), {
        onRetry: (attempt, total) => setRetryInfo({ attempt, total }),
      });
      dispatch({ type: 'SET_MEDIA_ID', payload: { mediaType: 'selfie', mediaId } });
      setRetryInfo(null);
      setIsUploading(false);
    } catch (err) {
      setRetryInfo(null);
      setIsUploading(false);
      const kycError = mapToKycError(err, 'upload');
      setUploadError(kycError.message);
      safeReportError(config.onError, kycError);
    }
  }

  // Report a denied camera permission to onError once. Liveness can't proceed
  // without a camera, so the dedicated permission screen (below) is shown too.
  const permissionReportedRef = useRef(false);
  useEffect(() => {
    if (camera.permissionDenied && !permissionReportedRef.current) {
      permissionReportedRef.current = true;
      safeReportError(
        config.onError,
        new KYCError(
          'camera_permission_denied',
          'Camera access is required for the liveness check. Please allow camera access and try again.',
        ),
      );
    }
    if (!camera.permissionDenied) permissionReportedRef.current = false;
  }, [camera.permissionDenied, config]);

  // Track the last active gesture so the avatar stays visible during transitions
  const phase = liveness.state.phase;
  const activeChallenge = phase === 'challenge' ? liveness.state.challenge : null;

  const lastGestureRef = useRef(activeChallenge?.type ?? null);
  useEffect(() => {
    if (activeChallenge?.type) {
      lastGestureRef.current = activeChallenge.type;
    }
  }, [activeChallenge?.type]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleRetake = () => {
    primeSpeech();
    setPreview(null);
    setUploadError(null);
    dispatch({ type: 'CLEAR_SELFIE_IMAGE' });
    dispatch({ type: 'CLEAR_LIVENESS_VIDEO' });
    // Discard current recording; a new one starts when camera restarts
    livenessChunksRef.current = [];
    const r = livenessRecorderRef.current;
    if (r && r.state !== 'inactive') { r.onstop = null; r.stop(); }
    livenessRecorderRef.current = null;
    liveness.retry();
  };

  const handleContinue = () => {
    camera.stop();
    dispatch({ type: 'SUBMIT_VERIFICATION' });
  };

  const handleBack = () => {
    camera.stop();
    const hasDocCapture = kycState.selectedIdType
      ? requiresDocumentCapture(kycState.selectedIdType)
      : false;
    dispatch({ type: 'SET_STEP', payload: hasDocCapture ? 'document-capture' : 'id-input' });
  };

  // ---------------------------------------------------------------------------
  // Preview mode (after selfie is captured)
  // ---------------------------------------------------------------------------

  if (preview) {
    return (
      <div className="space-y-5 animate-slide-up">
        <StepHeader title="Selfie Captured" description="Review your selfie before continuing." onBack={handleBack} />

        <div className="relative mx-auto w-56 sm:w-64 overflow-hidden rounded-full border-4 border-primary/20">
          <img src={preview} alt="Selfie preview" className="aspect-square w-full object-cover" />

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 animate-fade-in">
              <div className="relative flex items-center justify-center">
                <div className="absolute h-16 w-16 rounded-full border-2 border-primary/40 animate-pulse-ring" />
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 backdrop-blur-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              </div>
            </div>
          )}
        </div>

        {retryInfo && isUploading && (
          <p className="text-center text-xs text-amber-700 dark:text-amber-400">
            Upload failed — retrying ({retryInfo.attempt}/{retryInfo.total})…
          </p>
        )}

        {uploadError && (
          <p className="text-center text-sm text-destructive">{uploadError}</p>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={handleRetake} disabled={isCompressing || isUploading}>
            <RotateCcw className="h-4 w-4" />
            Retake
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={uploadError ? () => uploadSelfie(preview) : handleContinue}
            disabled={isCompressing || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {uploadError ? 'Retry Upload' : 'Continue'}
          </Button>
        </div>

        {isCompressing && <p className="text-center text-xs text-muted-foreground">Compressing image...</p>}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Camera permission denied
  // ---------------------------------------------------------------------------

  if (camera.permissionDenied) {
    return (
      <div className="space-y-5 animate-slide-up">
        <StepHeader title="Liveness Check" description="Camera access is required." onBack={handleBack} />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center space-y-2">
          <p className="text-sm font-medium text-destructive">Camera access was denied</p>
          <p className="text-xs text-muted-foreground">
            Liveness verification requires camera access. Please allow camera access in your browser settings and try again.
          </p>
        </div>
        <Button className="w-full" onClick={() => camera.restart('user')}>
          Try Again
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Camera permission primer (before the OS prompt)
  // ---------------------------------------------------------------------------

  if (needsPrimer) {
    return (
      <div className="space-y-5 animate-slide-up">
        <StepHeader
          title="Liveness Check"
          description="We'll use your camera to verify you're a real person."
          onBack={handleBack}
        />
        <CameraPermissionPrimer
          bodyText="When prompted, allow camera access to continue your verification."
          onGrant={() => {
            // Speech needs a user gesture to start — prime it here.
            primeSpeech();
            setPrimed(true);
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main liveness UI
  // ---------------------------------------------------------------------------

  const showAvatar = phase === 'challenge' || phase === 'challenge_passed';
  const avatarGesture = activeChallenge?.type ?? lastGestureRef.current;

  // Show the gray loading overlay only while the camera stream hasn't started yet.
  // Face mesh loading is separate — once the camera is live we show the feed and
  // display a non-blocking text indicator while the model finishes downloading.
  const isLoading = !camera.isReady;
  const isFaceMeshLoading = phase === 'loading' && camera.isReady;

  const challengeWarning = phase === 'challenge' ? liveness.state.warning : undefined;
  const hasWrongGesture = challengeWarning === 'wrong_gesture';
  const hasMultipleFaces = challengeWarning === 'multiple_faces';
  const hasPositionWarning = challengeWarning && !hasWrongGesture;

  // 'multiple_faces' is a sentinel — render the friendly guidance, not the code.
  const warningText = hasMultipleFaces ? 'Make sure only your face is visible' : challengeWarning;

  const instructionText = isFaceMeshLoading
    ? 'Preparing face detection...'
    : hasPositionWarning
      ? warningText
      : getInstructionText(liveness.state);

  const ringColor = isLoading || isFaceMeshLoading
    ? 'border-gray-300'
    : hasWrongGesture || hasPositionWarning
      ? 'border-destructive'
      : phase === 'challenge_passed' || phase === 'capturing' || phase === 'complete'
        ? 'border-[var(--kyc-success)]'
        : phase === 'challenge'
          ? 'border-[var(--kyc-warning)]'
          : phase === 'failed'
            ? 'border-destructive'
            : liveness.isFaceDetected
              ? 'border-primary/60'
              : 'border-gray-300';

  return (
    <div className="space-y-5 animate-slide-up">
      <StepHeader
        title="Liveness Check"
        description={isLoading ? 'Preparing your camera for verification.' : 'Follow the instructions below to verify you are a real person.'}
        onBack={handleBack}
      />

      <div className="flex flex-col items-center gap-5">
        {/* Instruction text */}
        <p className={cn(
          'text-base font-semibold min-h-6 text-center transition-colors duration-200',
          (isLoading || isFaceMeshLoading) ? 'text-muted-foreground' :
          hasWrongGesture || hasPositionWarning ? 'text-destructive' :
          phase === 'challenge_passed' || phase === 'complete' ? 'text-[var(--kyc-success)]' :
          phase === 'challenge' ? 'text-[var(--kyc-warning)]' :
          phase === 'failed' ? 'text-destructive' :
          'text-foreground',
        )}>
          {isLoading ? 'Setting up...' : hasWrongGesture ? 'Wrong gesture' : instructionText}
        </p>

        {/* Circular camera view */}
        <div className="relative">
          <div
            className={cn(
              'relative h-64 w-64 sm:h-80 sm:w-80 overflow-hidden rounded-full border-4 transition-colors duration-300',
              ringColor,
            )}
          >
            <video
              ref={camera.videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover transform-[scaleX(-1)]"
            />

            {/* Face guide overlay (dashed oval) */}
            <div className="pointer-events-none absolute inset-0">
              <svg className="h-full w-full" viewBox="0 0 224 224">
                <ellipse
                  cx="112"
                  cy="102"
                  rx="60"
                  ry="78"
                  fill="none"
                  stroke="var(--kyc-success)"
                  strokeWidth="2"
                  strokeDasharray="8,5"
                  opacity={liveness.isFaceDetected ? 0.8 : 0.4}
                  className="transition-opacity duration-300"
                />
              </svg>
            </div>

            {/* Loading overlay — shown while the camera starts and while the
                face-mesh model finishes downloading. */}
            {(isLoading || isFaceMeshLoading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 animate-fade-in">
                <div className="relative flex items-center justify-center">
                  <div className="absolute h-16 w-16 rounded-full border-2 border-primary/40 animate-pulse-ring" />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 backdrop-blur-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </div>
              </div>
            )}

            {/* Challenge passed flash */}
            {phase === 'challenge_passed' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--kyc-success)]/20 animate-fade-in">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--kyc-success)] animate-checkmark-pop">
                  <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 30, strokeDashoffset: 0 }} className="animate-checkmark" />
                  </svg>
                </div>
              </div>
            )}

            {/* Capturing flash */}
            {phase === 'capturing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/30 animate-fade-in">
                <p className="text-sm font-semibold text-white drop-shadow-md">Got it!</p>
              </div>
            )}
          </div>
        </div>

        {/* Lighting warning (too dark or too bright) */}
        {(isDim || isBright) && (
          <div className="flex w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 animate-lighting-in dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
              <path d="M9 18h6M10 22h4"/>
            </svg>
            <span>
              {isBright
                ? 'Too bright — reduce glare or move away from direct light for better detection.'
                : 'It looks dark here. Move to a brighter area or near a light source for better detection.'}
            </span>
          </div>
        )}

        {/* Progress dots */}
        {liveness.challenges.length > 0 && (
          <div className="flex items-center gap-0">
            {liveness.challenges.map((entry, i) => (
              <React.Fragment key={i}>
                <ProgressDot entry={entry} index={i} />
                {i < liveness.challenges.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-8 transition-colors duration-300',
                      entry.progress === 'passed' ? 'bg-[var(--kyc-success)]' : 'bg-gray-300',
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Animated avatar */}
        <LivenessAvatar gesture={avatarGesture} visible={showAvatar} assetsBasePath={config.assetsBasePath} />

        {/* Failed state — retry */}
        {phase === 'failed' && (
          <div className="w-full space-y-3">
            <p className="text-center text-sm text-destructive">
              {liveness.state.reason === 'timeout'
                ? "Time's up. Let's try again."
                : liveness.state.reason === 'face_lost'
                  ? 'Face lost. Please try again.'
                  : liveness.state.reason === 'load_error'
                    ? 'Failed to load liveness detection. Check your connection and try again.'
                    : 'Something went wrong.'}
            </p>
            <Button className="w-full" onClick={liveness.retry}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress dot
// ---------------------------------------------------------------------------

function ProgressDot({ entry, index }: { entry: ChallengeEntry; index: number }) {
  if (entry.progress === 'passed') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--kyc-success)] text-white animate-checkmark-pop">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" className="animate-checkmark" style={{ strokeDasharray: 30, strokeDashoffset: 0 }} />
        </svg>
      </div>
    );
  }

  if (entry.progress === 'active') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--kyc-success)] bg-background text-[var(--kyc-success)] font-semibold text-sm">
        {index + 1}
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500 text-sm font-medium">
      {index + 1}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instruction text helper
// ---------------------------------------------------------------------------

function getInstructionText(state: ReturnType<typeof useLiveness>['state']): string {
  switch (state.phase) {
    case 'loading':
      return 'Loading...';
    case 'positioning':
      return state.guidance;
    case 'challenge':
      return state.challenge.instruction;
    case 'challenge_passed':
      return 'Great!';
    case 'capturing':
      return 'Kindly hold still...';
    case 'complete':
      return 'Liveness verified!';
    case 'failed':
      return '';
    default:
      return '';
  }
}
