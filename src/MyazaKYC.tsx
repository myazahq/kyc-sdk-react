'use client';

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KYCProvider, useKYCContext } from './context/KYCContext';
import { KYCConfigProvider, useKYCConfig, type ServerSdkConfig } from './context/KYCConfigContext';
import { KYCModal } from './components/KYCModal';
import { Button } from './components/ui/button';
import { buildThemeVars } from './lib/theme';
import { primeFaceMesh } from './liveness/face-mesh';
import { configureSpeech } from './liveness/speech';
import { mergeWorkflowConfig } from './lib/workflow-merge';
import { safeReportError } from './lib/errors';
import { isDesktopDevice } from './lib/device';
import { resolveBaseUrl } from './lib/resolve-url';
import { createKYCApi, KYCApiError, type WorkflowResolutionResponse, type HandoffSessionSnapshot } from './services/api';
import { KYCError } from './types/verification';
import { ID_TYPES } from './utils/countries';
import { resetIntegritySignals } from './lib/integrity-signals';
import type { MyazaKYCConfig, MyazaKYCProps, UseMyazaKYCReturn, KYCStep, SupportedCountry } from './types/config';
import type { SubjectType, WorkflowBusinessConfig } from './types/business';

// Lazy-loaded so the QR/handoff code (and qrcode.react) is code-split out of the
// initial bundle — it only loads when a desktop user actually reaches the gate.
const DeviceHandoffGate = lazy(() => import('./components/DeviceHandoffGate'));

/**
 * Builder-preview step driver: when `previewStep` changes, jump the flow to
 * that step, seeding prerequisite state (an ID type of the right kind) so
 * mid-flow steps render sensibly. Renders nothing; inert unless the prop is set.
 */
function PreviewStepDriver({ step }: { step: KYCStep | null | undefined }) {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig(); // effective country/idTypes (post country-select)
  const stateRef = useRef({ selectedIdType: state.selectedIdType, config });
  stateRef.current = { selectedIdType: state.selectedIdType, config };

  useEffect(() => {
    if (!step) return;
    const { selectedIdType, config: cfg } = stateRef.current;
    if (step === 'document-capture' || step === 'id-input' || step === 'liveness' || step === 'nfc') {
      const all = ID_TYPES[cfg.country] ?? [];
      const offered = cfg.idTypes?.length ? all.filter((t) => cfg.idTypes!.includes(t.key)) : all;
      const current = offered.find((t) => t.key === selectedIdType);
      const needsDocument = step === 'document-capture' || step === 'nfc';
      const fits =
        current && (step === 'liveness' || current.requiresDocumentCapture === needsDocument);
      if (!fits) {
        const pick =
          step === 'liveness'
            ? offered[0]
            : step === 'nfc'
              ? // Chip reads live on eMRTDs — seed the passport when offered so
                // the preview shows the realistic pairing.
                offered.find((t) => t.key === 'passport') ??
                offered.find((t) => t.requiresDocumentCapture)
              : offered.find((t) => t.requiresDocumentCapture === needsDocument);
        if (pick) dispatch({ type: 'SELECT_ID_TYPE', payload: pick.key });
      }
    }
    dispatch({ type: 'SET_STEP', payload: step });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return null;
}

// ---------------------------------------------------------------------------
// Inner component (has access to KYCContext)
// ---------------------------------------------------------------------------

type KYCInnerProps = MyazaKYCProps<SupportedCountry> & {
  /**
   * Pre-resolved server config, provided by WorkflowGate (flow mode) so the
   * provider skips the /config fetch — the flow resolution already carried
   * idTypes + branding (or the blocking error state).
   */
  serverConfigOverride?: ServerSdkConfig;
};

function KYCInner({
  devUrl,
  apiKey,
  workflowId,
  subjectType,
  business,
  country,
  countries,
  idTypes,
  metadata,
  userId,
  userData,
  assetsBasePath,
  enableSelfie,
  enableDocumentCapture,
  allowDocumentUpload,
  enableLiveness,
  livenessMode,
  deviceIntelligence,
  voiceGuidance,
  showThemeToggle,
  fullScreen,
  disableClose,
  deviceHandoff,
  defaultOpen,
  previewMode,
  previewStep,
  serverConfigOverride,
  onStart,
  onStepChange,
  onSubmit,
  onClose,
  onError,
  appearance,
  consent,
  success,
  questionnaire,
  proofOfAddress,
  ...triggerProps
}: KYCInnerProps) {
  const { state, dispatch } = useKYCContext();
  const prevStepRef = useRef<KYCStep>(state.currentStep);

  // Device-handoff gate (continue-on-phone). Shown before the flow on desktop
  // when enabled; the gate owns its own session + polling and never touches the
  // KYC reducer (so SubmittedStep's auto-submit can't fire on the desktop).
  const [gateOpen, setGateOpen] = useState(false);

  // Snapshot the desktop sends to mint a handoff session — the phone renders
  // the same flow from it. `userId` rides along (an opaque reference, like
  // metadata) so a phone-completed verification still links to the org's user.
  // userData is included so greeting tokens work on the phone (the token URL is
  // already the secret, same risk level as a magic link).
  const handoffSnapshot = useMemo<HandoffSessionSnapshot>(() => ({
    country: country as SupportedCountry,
    ...(workflowId ? { workflowId } : {}),
    ...(idTypes ? { idTypes } : {}),
    ...(countries ? { countries } : {}),
    ...(enableSelfie !== undefined ? { enableSelfie } : {}),
    ...(enableDocumentCapture !== undefined ? { enableDocumentCapture } : {}),
    ...(allowDocumentUpload !== undefined ? { allowDocumentUpload } : {}),
    ...(enableLiveness !== undefined ? { enableLiveness } : {}),
    ...(livenessMode !== undefined ? { livenessMode } : {}),
    ...(deviceIntelligence !== undefined ? { deviceIntelligence } : {}),
    ...(voiceGuidance !== undefined ? { voiceGuidance } : {}),
    ...(showThemeToggle !== undefined ? { showThemeToggle } : {}),
    ...(fullScreen !== undefined ? { fullScreen } : {}),
    ...(disableClose !== undefined ? { disableClose } : {}),
    ...(appearance ? { appearance: appearance as Record<string, unknown> } : {}),
    ...(consent ? { consent: consent as Record<string, unknown> } : {}),
    ...(success ? { success: success as Record<string, unknown> } : {}),
    ...(questionnaire ? { questionnaire: questionnaire as { fields: unknown[] } } : {}),
    ...(proofOfAddress ? { proofOfAddress } : {}),
    ...(metadata ? { metadata } : {}),
    ...(userId ? { userId } : {}),
    ...(userData ? { userData } : {}),
    ...(assetsBasePath ? { assetsBasePath } : {}),
  }), [country, workflowId, idTypes, countries, enableSelfie, enableDocumentCapture, allowDocumentUpload, enableLiveness, livenessMode, deviceIntelligence, voiceGuidance, showThemeToggle, fullScreen, disableClose, appearance, consent, success, questionnaire, proofOfAddress, metadata, userId, userData, assetsBasePath]);

  // Pre-load MediaPipe Face Mesh model as soon as the SDK mounts and apply the
  // voice-guidance config (enabled + language) for the spoken liveness prompts.
  // Preview mode renders camera placeholders, so the ~4MB model is never needed.
  useEffect(() => {
    // Business (KYB) flows have no camera/liveness step — never load the model.
    if (enableLiveness !== false && !previewMode && subjectType !== 'business') primeFaceMesh();
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
  // needs a camera (skip pure number-only-no-liveness flows and business/KYB
  // flows — a registry lookup has nothing to hand off to a phone for).
  const cameraNeeded =
    subjectType !== 'business' && (enableLiveness !== false || enableDocumentCapture !== false);

  const handleOpen = useCallback(() => {
    resetIntegritySignals(); // fresh capture-integrity slate per session
    seedUserData();
    onStart?.();
    if (deviceHandoff !== false && cameraNeeded && isDesktopDevice()) {
      setGateOpen(true);
    } else {
      dispatch({ type: 'OPEN_MODAL' });
    }
  }, [dispatch, onStart, seedUserData, deviceHandoff, cameraNeeded]);

  // Preview/embedded surfaces: start the flow immediately, no trigger button.
  // Skips the handoff gate — an auto-opened preview never hands off.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!defaultOpen || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    resetIntegritySignals();
    seedUserData();
    onStart?.();
    dispatch({ type: 'OPEN_MODAL' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen]);

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
      workflowId={workflowId}
      serverConfigOverride={serverConfigOverride}
      subjectType={subjectType}
      business={business}
      country={country as SupportedCountry}
      countries={countries}
      idTypes={idTypes}
      metadata={metadata}
      userId={userId}
      userData={userData}
      enableSelfie={enableSelfie}
      enableDocumentCapture={enableDocumentCapture}
      allowDocumentUpload={allowDocumentUpload}
      enableLiveness={enableLiveness}
      livenessMode={livenessMode}
      deviceHandoff={deviceHandoff}
      assetsBasePath={assetsBasePath}
      appearance={appearance}
      consent={consent}
      success={success}
      questionnaire={questionnaire}
      proofOfAddress={proofOfAddress}
      previewMode={previewMode}
      onSubmit={onSubmit}
      onClose={handleClose}
      onError={onError}
    >
      {previewStep !== undefined && <PreviewStepDriver step={previewStep} />}
      {!defaultOpen && (
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
      )}

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

      <KYCModal open={state.isOpen} onClose={handleClose} showThemeToggle={showThemeToggle} disableClose={disableClose} fullScreen={fullScreen} />
    </KYCConfigProvider>
  );
}

// ---------------------------------------------------------------------------
// Flow gate — resolves a published flow before the SDK renders
// ---------------------------------------------------------------------------

// Map a flow-resolution failure to a user-facing message + typed code. Every
// failure is blocking: running with silently different config (ignoring the
// flow) would be worse than stopping. A page reload retries.
function describeFlowError(err: unknown): { message: string; statusCode?: number; code: KYCError['code'] } {
  if (err instanceof KYCApiError) {
    if (err.statusCode === 404) {
      return {
        message: 'This verification flow does not exist, is not published, or does not belong to this API key.',
        statusCode: 404,
        code: 'invalid_workflow',
      };
    }
    if (err.statusCode === 401) {
      return { message: 'Invalid API key. Please check the API key configured in the SDK.', statusCode: 401, code: 'invalid_api_key' };
    }
    if (err.statusCode === 403) {
      return { message: err.message || 'This API key is not permitted to use this flow.', statusCode: 403, code: 'invalid_workflow' };
    }
    return { message: err.message, statusCode: err.statusCode, code: 'unknown' };
  }
  if (err instanceof TypeError) {
    return { message: 'Network error while loading the verification flow. Please check your connection and reload.', code: 'network_error' };
  }
  return { message: err instanceof Error ? err.message : 'Failed to load the verification flow.', code: 'unknown' };
}

type WorkflowGateState =
  | { phase: 'loading' }
  | { phase: 'ready'; flow: WorkflowResolutionResponse }
  | { phase: 'error'; override: ServerSdkConfig };

/**
 * Wraps KYCInner when a `workflowId` prop is set: fetches the published flow,
 * merges its config over the props (flow wins), and hands the resolution's
 * idTypes/branding to the provider as a pre-resolved server config (so /config
 * is never fetched — one round trip). Failures render the normal SDK shell
 * with a fatal server-config error, so the trigger opens the modal's blocking
 * error screen instead of a silently different flow.
 */
function WorkflowGate(props: KYCInnerProps) {
  const { apiKey, devUrl, workflowId, defaultOpen, appearance, onError } = props;
  const api = useMemo(
    () => createKYCApi(resolveBaseUrl(apiKey, devUrl), apiKey),
    [apiKey, devUrl],
  );
  const [state, setState] = useState<WorkflowGateState>({ phase: 'loading' });
  // Report the failure to onError at most once per api+workflowId (StrictMode
  // double-mounts the effect in dev).
  const reportedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ phase: 'loading' });
    api
      .workflow(workflowId!)
      .then((flow) => {
        if (!cancelled) setState({ phase: 'ready', flow });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const { message, statusCode, code } = describeFlowError(err);
        setState({
          phase: 'error',
          override: { status: 'error', idTypes: [], error: message, statusCode, fatal: true },
        });
        const reportKey = `${workflowId}`;
        if (reportedRef.current !== reportKey) {
          reportedRef.current = reportKey;
          safeReportError(onError, new KYCError(code, message));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, workflowId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.phase === 'loading') {
    // Keep the trigger visible (disabled) while the flow loads so the page
    // doesn't jump; auto-open surfaces render nothing until ready.
    if (defaultOpen) return null;
    const { children, style } = props;
    return (
      <Button disabled style={{ ...buildThemeVars(appearance), ...style }}>
        {children ?? (appearance?.companyName ? `Verify with ${appearance.companyName}` : 'Verify Identity')}
      </Button>
    );
  }

  if (state.phase === 'error') {
    // Country may be absent in flow mode; the blocking error screen renders
    // before anything country-dependent, so any placeholder is safe.
    return (
      <KYCInner
        {...props}
        country={(props.country ?? 'NG') as SupportedCountry}
        serverConfigOverride={state.override}
      />
    );
  }

  const merged = mergeWorkflowConfig(
    state.flow.config,
    props as unknown as Record<string, unknown>,
  ) as unknown as KYCInnerProps;
  return (
    <KYCInner
      {...merged}
      serverConfigOverride={{
        status: 'ready',
        idTypes: state.flow.idTypes,
        environment: state.flow.environment,
        branding: state.flow.branding,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Public component  <MyazaKYC />
// ---------------------------------------------------------------------------

export function MyazaKYC<C extends SupportedCountry>(props: MyazaKYCProps<C>) {
  // Fail loud at integration time (same contract as an invalid key prefix):
  // without a flow there is nothing to derive the country from. Business (KYB)
  // configs carry their registry country on the business block instead.
  const businessCountry = props.subjectType === 'business' ? props.business?.country : undefined;
  if (!props.workflowId && !props.country && !businessCountry) {
    throw new KYCError('unknown', 'MyazaKYC requires a `country` prop unless a `workflowId` is provided.');
  }
  const inner = {
    ...props,
    // Prop-configured business mounts (builder preview) have no top-level
    // country — the business block's registry country is the effective one.
    country: props.country ?? businessCountry,
  } as unknown as KYCInnerProps;
  return (
    <KYCProvider>
      {props.workflowId ? <WorkflowGate {...inner} /> : <KYCInner {...inner} />}
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
