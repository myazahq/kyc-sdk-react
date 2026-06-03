'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { KYCProvider, useKYCContext } from './context/KYCContext';
import { KYCConfigProvider } from './context/KYCConfigContext';
import { KYCModal } from './components/KYCModal';
import { Button } from './components/ui/button';
import { buildThemeVars } from './lib/theme';
import { primeFaceMesh } from './liveness/face-mesh';
import type { MyazaKYCConfig, UseMyazaKYCReturn, KYCStep, SupportedCountry } from './types/config';

// ---------------------------------------------------------------------------
// Inner component (has access to KYCContext)
// ---------------------------------------------------------------------------

interface KYCInnerProps extends MyazaKYCConfig<SupportedCountry> {}

function KYCInner({
  environment,
  devUrl,
  apiKey,
  country,
  idTypes,
  metadata,
  userData,
  enableSelfie,
  enableDocumentCapture,
  enableLiveness,
  showThemeToggle,
  onStart,
  onStepChange,
  onSubmit,
  onClose,
  onError,
  appearance,
  consent,
}: KYCInnerProps) {
  const { state, dispatch } = useKYCContext();
  const prevStepRef = useRef<KYCStep>(state.currentStep);

  // Pre-load MediaPipe Face Mesh model as soon as the SDK mounts
  useEffect(() => {
    if (enableLiveness !== false) primeFaceMesh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire onStepChange when the step changes
  useEffect(() => {
    if (state.currentStep !== prevStepRef.current) {
      prevStepRef.current = state.currentStep;
      onStepChange?.(state.currentStep);
    }
  }, [state.currentStep, onStepChange]);

  // Fire onError when a technical error is set
  useEffect(() => {
    if (state.error) {
      onError?.(new Error(state.error));
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
      environment={environment}
      devUrl={devUrl}
      apiKey={apiKey}
      country={country}
      idTypes={idTypes}
      metadata={metadata}
      userData={userData}
      enableSelfie={enableSelfie}
      enableDocumentCapture={enableDocumentCapture}
      enableLiveness={enableLiveness}
      appearance={appearance}
      consent={consent}
      onSubmit={onSubmit}
      onClose={handleClose}
    >
      <Button onClick={handleOpen} style={buildThemeVars(appearance)}>
        {appearance?.companyName
          ? `Verify with ${appearance.companyName}`
          : 'Verify Identity'}
      </Button>

      <KYCModal open={state.isOpen} onClose={handleClose} showThemeToggle={showThemeToggle} />
    </KYCConfigProvider>
  );
}

// ---------------------------------------------------------------------------
// Public component  <MyazaKYC />
// ---------------------------------------------------------------------------

export function MyazaKYC<C extends SupportedCountry>(props: MyazaKYCConfig<C>) {
  return (
    <KYCProvider>
      <KYCInner {...props as MyazaKYCConfig<SupportedCountry>} />
    </KYCProvider>
  );
}

// ---------------------------------------------------------------------------
// Public hook  useMyazaKYC()
// ---------------------------------------------------------------------------

export function useMyazaKYC<C extends SupportedCountry>(config: MyazaKYCConfig<C>): UseMyazaKYCReturn {
  const { state, dispatch } = useKYCContext();

  const prevStepRef = useRef<KYCStep>(state.currentStep);

  useEffect(() => {
    if (state.currentStep !== prevStepRef.current) {
      prevStepRef.current = state.currentStep;
      config.onStepChange?.(state.currentStep);
    }
  }, [state.currentStep, config.onStepChange]);

  useEffect(() => {
    if (state.error) {
      config.onError?.(new Error(state.error));
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
