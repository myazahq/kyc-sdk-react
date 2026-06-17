'use client';

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KYCProvider, useKYCContext } from './context/KYCContext';
import { KYCConfigProvider } from './context/KYCConfigContext';
import { KYCModal } from './components/KYCModal';
import { Button } from './components/ui/button';
import { buildThemeVars } from './lib/theme';
import { primeFaceMesh } from './liveness/face-mesh';
import { configureSpeech } from './liveness/speech';
import { safeReportError } from './lib/errors';
import { isDesktopDevice } from './lib/device';
import type { HandoffSessionSnapshot } from './services/api';
import type { MyazaKYCConfig, MyazaKYCProps, UseMyazaKYCReturn, KYCStep, SupportedCountry } from './types/config';

// Lazy-loaded so the QR/handoff code (and qrcode.react) is code-split out of the
// initial bundle — it only loads when a desktop user actually reaches the gate.
const DeviceHandoffGate = lazy(() => import('./components/DeviceHandoffGate'));

// ---------------------------------------------------------------------------
// Inner component (has access to KYCContext)
// ---------------------------------------------------------------------------

type KYCInnerProps = MyazaKYCProps<SupportedCountry>;

function KYCInner({
  devUrl,
  apiKey,
  country,
  idTypes,
  metadata,
  userData,
  assetsBasePath,
  enableSelfie,
  enableDocumentCapture,
  allowDocumentUpload,
  enableLiveness,
  voiceGuidance,
  showThemeToggle,
  disableClose,
  deviceHandoff,
  onStart,
  onStepChange,
  onSubmit,
  onClose,
  onError,
  appearance,
  consent,
  success,
  ...triggerProps
}: KYCInnerProps) {
  const { state, dispatch } = useKYCContext();
  const prevStepRef = useRef<KYCStep>(state.currentStep);

  // Device-handoff gate (continue-on-phone). Shown before the flow on desktop
  // when enabled; the gate owns its own session + polling and never touches the
  // KYC reducer (so SubmittedStep's auto-submit can't fire on the desktop).
  const [gateOpen, setGateOpen] = useState(false);

  // Snapshot the desktop sends to mint a handoff session — the phone renders
  // the same flow from it. userData is included so greeting tokens work on the
  // phone (the token URL is already the secret, same risk level as a magic link).
  const handoffSnapshot = useMemo<HandoffSessionSnapshot>(() => ({
    country,
    ...(idTypes ? { idTypes } : {}),
    ...(enableSelfie !== undefined ? { enableSelfie } : {}),
    ...(enableDocumentCapture !== undefined ? { enableDocumentCapture } : {}),
    ...(allowDocumentUpload !== undefined ? { allowDocumentUpload } : {}),
    ...(enableLiveness !== undefined ? { enableLiveness } : {}),
    ...(voiceGuidance !== undefined ? { voiceGuidance } : {}),
    ...(showThemeToggle !== undefined ? { showThemeToggle } : {}),
    ...(disableClose !== undefined ? { disableClose } : {}),
    ...(appearance ? { appearance: appearance as Record<string, unknown> } : {}),
    ...(consent ? { consent: consent as Record<string, unknown> } : {}),
    ...(success ? { success: success as Record<string, unknown> } : {}),
    ...(metadata ? { metadata } : {}),
    ...(userData ? { userData } : {}),
    ...(assetsBasePath ? { assetsBasePath } : {}),
  }), [country, idTypes, enableSelfie, enableDocumentCapture, allowDocumentUpload, enableLiveness, voiceGuidance, showThemeToggle, disableClose, appearance, consent, success, metadata, userData, assetsBasePath]);

  // Pre-load MediaPipe Face Mesh model as soon as the SDK mounts and apply the
  // voice-guidance config (enabled + language) for the spoken liveness prompts.
  useEffect(() => {
    if (enableLiveness !== false) primeFaceMesh();
    configureSpeech(voiceGuidance);
  }, [voiceGuidance]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire onStepChange when the step changes
  useEffect(() => {
    if (state.currentStep !== prevStepRef.current) {
      prevStepRef.current = state.currentStep;
      onStepChange?.(state.currentStep);
    }
  }, [state.currentStep, onStepChange]);

  // Fire onError when a technical error is set. `state.error` is a typed
  // KYCError (still an Error), so consumers can narrow on `error.code`.
  useEffect(() => {
    if (state.error) {
      safeReportError(onError, state.error);
    }
  }, [state.error, onError]);

  // Seed any pre-filled userData into the reducer. Shared by both entry paths.
  const seedUserData = useCallback(() => {
    if (userData) {
      dispatch({ type: 'SET_USER_DATA', payload: {
        ...(userData.firstName ? { firstName: userData.firstName } : {}),
        ...(userData.lastName ? { lastName: userData.lastName } : {}),
        ...(userData.dateOfBirth ? { dateOfBirth: userData.dateOfBirth } : {}),
      }});
    }
  }, [dispatch, userData]);

  // Offer handoff only on desktop, when enabled, and when the flow plausibly
  // needs a camera (skip pure number-only-no-liveness flows).
  const cameraNeeded = enableLiveness !== false || enableDocumentCapture !== false;

  const handleOpen = useCallback(() => {
    seedUserData();
    onStart?.();
    if (deviceHandoff !== false && cameraNeeded && isDesktopDevice()) {
      setGateOpen(true);
    } else {
      dispatch({ type: 'OPEN_MODAL' });
    }
  }, [dispatch, onStart, seedUserData, deviceHandoff, cameraNeeded]);

  // User chose to verify on this computer: leave the gate, start the flow.
  const handleContinueHere = useCallback(() => {
    setGateOpen(false);
    dispatch({ type: 'OPEN_MODAL' });
  }, [dispatch]);

  const handleGateClose = useCallback(() => {
    setGateOpen(false);
    onClose?.();
  }, [onClose]);

  const handleClose = useCallback(() => {
    dispatch({ type: 'CLOSE_MODAL' });
    onClose?.();
  }, [dispatch, onClose]);

  return (
    <KYCConfigProvider
      devUrl={devUrl}
      apiKey={apiKey}
      country={country}
      idTypes={idTypes}
      metadata={metadata}
      userData={userData}
      enableSelfie={enableSelfie}
      enableDocumentCapture={enableDocumentCapture}
      allowDocumentUpload={allowDocumentUpload}
      enableLiveness={enableLiveness}
      deviceHandoff={deviceHandoff}
      assetsBasePath={assetsBasePath}
      appearance={appearance}
      consent={consent}
      success={success}
      onSubmit={onSubmit}
      onClose={handleClose}
      onError={onError}
    >
      <Button
        {...triggerProps}
        onClick={handleOpen}
        style={{ ...buildThemeVars(appearance), ...triggerProps.style }}
      >
        {triggerProps.children ??
          (appearance?.companyName
            ? `Verify with ${appearance.companyName}`
            : 'Verify Identity')}
      </Button>

      {gateOpen && (
        <Suspense fallback={null}>
          <DeviceHandoffGate
            snapshot={handoffSnapshot}
            onContinueHere={handleContinueHere}
            onClose={handleGateClose}
            showThemeToggle={showThemeToggle}
            disableClose={disableClose}
          />
        </Suspense>
      )}

      <KYCModal open={state.isOpen} onClose={handleClose} showThemeToggle={showThemeToggle} disableClose={disableClose} />
    </KYCConfigProvider>
  );
}

// ---------------------------------------------------------------------------
// Public component  <MyazaKYC />
// ---------------------------------------------------------------------------

export function MyazaKYC<C extends SupportedCountry>(props: MyazaKYCProps<C>) {
  return (
    <KYCProvider>
      <KYCInner {...props as MyazaKYCProps<SupportedCountry>} />
    </KYCProvider>
  );
}

// ---------------------------------------------------------------------------
// Public hook  useMyazaKYC()
// ---------------------------------------------------------------------------

export function useMyazaKYC<C extends SupportedCountry>(config: MyazaKYCConfig<C>): UseMyazaKYCReturn {
  const { state, dispatch } = useKYCContext();

  const prevStepRef = useRef<KYCStep>(state.currentStep);

  // Apply the voice-guidance config (enabled + language) for spoken prompts.
  useEffect(() => {
    configureSpeech(config.voiceGuidance);
  }, [config.voiceGuidance]);

  useEffect(() => {
    if (state.currentStep !== prevStepRef.current) {
      prevStepRef.current = state.currentStep;
      config.onStepChange?.(state.currentStep);
    }
  }, [state.currentStep, config.onStepChange]);

  useEffect(() => {
    if (state.error) {
      safeReportError(config.onError, state.error);
    }
  }, [state.error, config.onError]);

  const open = useCallback(() => {
    dispatch({ type: 'OPEN_MODAL' });
    config.onStart?.();
  }, [dispatch, config.onStart]);

  const close = useCallback(() => {
    dispatch({ type: 'CLOSE_MODAL' });
    config.onClose?.();
  }, [dispatch, config.onClose]);

  return {
    open,
    close,
    isOpen: state.isOpen,
    currentStep: state.isOpen ? state.currentStep : null,
  };
}
