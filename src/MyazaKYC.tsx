'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { KYCProvider, useKYCContext } from './context/KYCContext';
import { KYCConfigProvider } from './context/KYCConfigContext';
import { KYCModal } from './components/KYCModal';
import { Button } from './components/ui/button';
import { buildThemeVars } from './lib/theme';
import { primeFaceMesh } from './liveness/face-mesh';
import { configureSpeech } from './liveness/speech';
import { safeReportError } from './lib/errors';
import type { MyazaKYCConfig, MyazaKYCProps, UseMyazaKYCReturn, KYCStep, SupportedCountry } from './types/config';

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
  enableSelfie,
  enableDocumentCapture,
  allowDocumentUpload,
  enableLiveness,
  voiceGuidance,
  showThemeToggle,
  disableClose,
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

  const handleOpen = useCallback(() => {
    if (userData) {
      dispatch({ type: 'SET_USER_DATA', payload: {
        ...(userData.firstName ? { firstName: userData.firstName } : {}),
        ...(userData.lastName ? { lastName: userData.lastName } : {}),
        ...(userData.dateOfBirth ? { dateOfBirth: userData.dateOfBirth } : {}),
      }});
    }
    dispatch({ type: 'OPEN_MODAL' });
    onStart?.();
  }, [dispatch, onStart, userData]);

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
