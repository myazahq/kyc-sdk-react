'use client';

import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { StepHeader } from './StepHeader';
import { Button } from './ui/button';
import { CameraPermissionPrimer } from './CameraPermissionPrimer';
import { LivenessAvatar } from '../steps/LivenessAvatar';
import { useCamera } from '../hooks/useCamera';
import { useCameraPrimer } from '../hooks/useCameraPrimer';
import { useImageCapture } from '../hooks/useImageCapture';
import { useImageCompress } from '../hooks/useImageCompress';
import { useLiveness } from '../hooks/useLiveness';
import { useLightLevel } from '../hooks/useLightLevel';
import { primeSpeech } from '../liveness/speech';
import { KYCError } from '../types/verification';
import type { ChallengeEntry } from '../liveness/challenge-manager';

// Self-contained active-liveness capture for biometric re-authentication. Reuses
// the SDK's liveness HOOKS and shared sub-components, but is decoupled from the
// KYC reducer/config context (so the returning-user flow can't regress the main
// onboarding flow). On success it hands the compressed selfie dataURL straight
// to `onComplete` — no preview, no video recording, no navigation.

interface BiometricLivenessCaptureProps {
  livenessMode: 'gestures' | 'flash' | 'both';
  assetsBasePath?: string;
  onComplete: (selfieBase64: string) => void;
  onError?: (error: KYCError) => void;
  onBack?: () => void;
}

export function BiometricLivenessCapture({
  livenessMode,
  assetsBasePath,
  onComplete,
  onError,
  onBack,
}: BiometricLivenessCaptureProps) {
  const primerStatus = useCameraPrimer();
  const [primed, setPrimed] = React.useState(false);
  const needsPrimer = primerStatus === 'needed' && !primed;

  const camera = useCamera({ facingMode: 'user', enabled: primerStatus === 'granted' || primed });
  const { capture } = useImageCapture({ videoRef: camera.videoRef, mirror: true });
  const { compress } = useImageCompress();
  const { level: lightLevel } = useLightLevel(camera.videoRef, camera.isReady);
  const isDim = lightLevel === 'dark';
  const isBright = lightLevel === 'bright';

  const liveness = useLiveness({
    videoRef: camera.videoRef,
    cameraReady: camera.isReady,
    captureFrame: capture,
    compressImage: compress,
    lightLevel,
    config: { mode: livenessMode },
  });

  // Hand the selfie up exactly once when liveness completes.
  const firedRef = useRef(false);
  useEffect(() => {
    if (liveness.state.phase === 'complete' && !firedRef.current) {
      firedRef.current = true;
      camera.stop();
      onComplete(liveness.state.selfieBase64);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveness.state.phase]);

  // Report a denied camera permission once.
  const reportedRef = useRef(false);
  useEffect(() => {
    if (camera.permissionDenied && !reportedRef.current) {
      reportedRef.current = true;
      onError?.(
        new KYCError('camera_permission_denied', 'Camera access is required to verify it is you.'),
      );
    }
    if (!camera.permissionDenied) reportedRef.current = false;
  }, [camera.permissionDenied, onError]);

  const phase = liveness.state.phase;
  const activeChallenge = phase === 'challenge' ? liveness.state.challenge : null;
  const lastGestureRef = useRef(activeChallenge?.type ?? null);
  useEffect(() => {
    if (activeChallenge?.type) lastGestureRef.current = activeChallenge.type;
  }, [activeChallenge?.type]);

  if (camera.permissionDenied) {
    return (
      <div className="space-y-5 animate-slide-up">
        <StepHeader title="Verify it's you" description="Camera access is required." onBack={onBack} />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center space-y-2">
          <p className="text-sm font-medium text-destructive">Camera access was denied</p>
          <p className="text-xs text-muted-foreground">
            Allow camera access in your browser settings and try again.
          </p>
        </div>
        <Button className="w-full" onClick={() => camera.restart('user')}>
          Try Again
        </Button>
      </div>
    );
  }

  if (needsPrimer) {
    return (
      <div className="space-y-5 animate-slide-up">
        <StepHeader
          title="Verify it's you"
          description="We'll use your camera to confirm you're really here."
          onBack={onBack}
        />
        <CameraPermissionPrimer
          bodyText="When prompted, allow camera access to continue."
          onGrant={() => {
            primeSpeech();
            setPrimed(true);
          }}
        />
      </div>
    );
  }

  const isFlashChallenge = activeChallenge?.type === 'flash';
  const showAvatar = (phase === 'challenge' || phase === 'challenge_passed') && !isFlashChallenge;
  const avatarGesture = activeChallenge?.type ?? lastGestureRef.current;
  const isLoading = !camera.isReady;
  const isFaceMeshLoading = phase === 'loading' && camera.isReady;
  const warning = phase === 'challenge' ? liveness.state.warning : undefined;
  const hasWrongGesture = warning === 'wrong_gesture';
  const hasMultipleFaces = warning === 'multiple_faces';
  const hasPositionWarning = warning && !hasWrongGesture;
  const warningText = hasMultipleFaces ? 'Make sure only your face is visible' : warning;
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
      {liveness.flashColor && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[90]"
          style={{ backgroundColor: liveness.flashColor, opacity: 0.96, transition: 'background-color 120ms linear' }}
        />
      )}

      <StepHeader
        title="Verify it's you"
        description={isLoading ? 'Preparing your camera.' : 'Follow the instructions below to confirm you are a real person.'}
        onBack={onBack}
      />

      <div className="flex flex-col items-center gap-5">
        <p
          className={cn(
            'text-base font-semibold min-h-6 text-center transition-colors duration-200',
            isLoading || isFaceMeshLoading
              ? 'text-muted-foreground'
              : hasWrongGesture || hasPositionWarning
                ? 'text-destructive'
                : phase === 'challenge_passed' || phase === 'complete'
                  ? 'text-[var(--kyc-success)]'
                  : phase === 'challenge'
                    ? 'text-[var(--kyc-warning)]'
                    : phase === 'failed'
                      ? 'text-destructive'
                      : 'text-foreground',
          )}
        >
          {isLoading ? 'Setting up...' : hasWrongGesture ? 'Wrong gesture' : instructionText}
        </p>

        <div className={cn('relative h-64 w-64 sm:h-80 sm:w-80 overflow-hidden rounded-full border-4 transition-colors duration-300', ringColor)}>
          <video ref={camera.videoRef} autoPlay playsInline muted className="h-full w-full object-cover transform-[scaleX(-1)]" />
          <div className="pointer-events-none absolute inset-0">
            <svg className="h-full w-full" viewBox="0 0 224 224">
              <ellipse cx="112" cy="102" rx="60" ry="78" fill="none" stroke="var(--kyc-success)" strokeWidth="2" strokeDasharray="8,5" opacity={liveness.isFaceDetected ? 0.8 : 0.4} className="transition-opacity duration-300" />
            </svg>
          </div>
          {(isLoading || isFaceMeshLoading) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 animate-fade-in">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            </div>
          )}
          {phase === 'challenge_passed' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--kyc-success)]/20 animate-fade-in">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--kyc-success)] animate-checkmark-pop">
                <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
          {(phase === 'capturing' || phase === 'complete') && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/30 animate-fade-in">
              <p className="text-sm font-semibold text-white drop-shadow-md">Got it!</p>
            </div>
          )}
        </div>

        {(isDim || isBright) && (
          <p className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-center text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
            {isBright ? 'Too bright — reduce glare or move away from direct light.' : 'It looks dark — move to a brighter area for better detection.'}
          </p>
        )}

        {liveness.challenges.length > 0 && (
          <div className="flex items-center gap-0">
            {liveness.challenges.map((entry, i) => (
              <React.Fragment key={i}>
                <ProgressDot entry={entry} index={i} />
                {i < liveness.challenges.length - 1 && (
                  <div className={cn('h-0.5 w-8 transition-colors duration-300', entry.progress === 'passed' ? 'bg-[var(--kyc-success)]' : 'bg-gray-300')} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <LivenessAvatar gesture={avatarGesture} visible={showAvatar} assetsBasePath={assetsBasePath} />

        {phase === 'failed' && (
          <div className="w-full space-y-3">
            <p className="text-center text-sm text-destructive">
              {liveness.state.reason === 'timeout'
                ? "Time's up. Let's try again."
                : liveness.state.reason === 'face_lost'
                  ? 'Face lost. Please try again.'
                  : liveness.state.reason === 'flash_failed'
                    ? "We couldn't verify the screen reflection. Hold still, face the screen, and try again."
                    : liveness.state.reason === 'face_swap'
                      ? "We couldn't verify face continuity. Keep your face steady and try again."
                      : 'Something went wrong. Please try again.'}
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

function ProgressDot({ entry, index }: { entry: ChallengeEntry; index: number }) {
  if (entry.progress === 'passed') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--kyc-success)] text-white animate-checkmark-pop">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
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
      return 'Verified!';
    default:
      return '';
  }
}
