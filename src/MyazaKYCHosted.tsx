'use client';

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { KYCProvider, useKYCContext } from './context/KYCContext';
import { KYCConfigProvider, type ServerSdkConfig } from './context/KYCConfigContext';
import { KYCModal } from './components/KYCModal';
import { buildThemeVars } from './lib/theme';
import { isDesktopDevice } from './lib/device';
import { primeFaceMesh } from './liveness/face-mesh';
import { configureSpeech } from './liveness/speech';
import { createKYCApi, type HandoffBootstrapResponse, type HandoffSessionSnapshot, type KYCApi } from './services/api';

// Lazy-loaded so the QR/handoff code (+ qrcode.react) stays out of the initial
// hosted bundle — it only loads when a DESKTOP visitor reaches the gate.
const DeviceHandoffGate = lazy(() => import('./components/DeviceHandoffGate'));
import type {
  AnyCountry,
  AnyIdType,
  EmailVerificationConfig,
  KYCAppearance,
  KYCConsentContent,
  KYCSuccessContent,
  PhoneVerificationConfig,
  QuestionnaireConfig,
  ProofOfAddressConfig,
  NfcConfig,
  VoiceGuidanceOption,
} from './types/config';
import type { SubjectType, WorkflowBusinessConfig } from './types/business';

export interface MyazaKYCHostedProps {
  /**
   * The raw handoff session token from the hosted-page URL
   * (`/verify/<token>`). The SDK presents it as a `hs_<token>` bearer.
   */
  token: string;
}

// Bearer prefix for handoff session tokens (mirrors kyc-core's HANDOFF_TOKEN_PREFIX).
const HANDOFF_TOKEN_PREFIX = 'hs_';

/**
 * Hosted "continue on your phone" entry point. Rendered by the Myaza-hosted
 * verification page (`/verify/<token>`), NOT by customers directly. It bootstraps
 * the flow from the session token and runs the SAME steps as `<MyazaKYC />`,
 * authenticating every upload/verify with the session token (relative base URL,
 * so requests go through the hosting origin's API proxy).
 */
export function MyazaKYCHosted({ token }: MyazaKYCHostedProps) {
  // Relative base ('') → requests hit the hosting origin and its /api proxy.
  const [api] = useState<KYCApi>(() => createKYCApi('', `${HANDOFF_TOKEN_PREFIX}${token}`));
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bootstrap, setBootstrap] = useState<HandoffBootstrapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .bootstrapHandoff(token)
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'This verification link is no longer valid.');
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, token]);

  if (phase === 'loading') {
    return (
      <CenteredScreen>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your verification…</p>
      </CenteredScreen>
    );
  }

  if (phase === 'error' || !bootstrap) {
    return (
      <CenteredScreen>
        <h1 className="text-lg font-semibold font-heading">Link unavailable</h1>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          {error ?? 'This verification link has expired or already been used. Return to your computer to start again.'}
        </p>
      </CenteredScreen>
    );
  }

  return <HostedFlow token={token} api={api} bootstrap={bootstrap} />;
}

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="kyc-root flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground"
      style={buildThemeVars(undefined)}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hosted flow — seeds the providers from the bootstrap and runs the steps
// ---------------------------------------------------------------------------

function HostedFlow({
  token,
  api,
  bootstrap,
}: {
  token: string;
  api: KYCApi;
  bootstrap: HandoffBootstrapResponse;
}) {
  const snap = bootstrap.configSnapshot;
  const isBusiness = snap.subjectType === 'business' && !!snap.business;
  // Offer "continue on your phone" only when the flow has a capture/upload step
  // a phone camera actually helps with (mirrors <MyazaKYC/>). Individual flows:
  // liveness or document capture. KYB flows: the applicant's in-flow KYC or
  // company-document uploads (photograph on a phone) — a bare registry lookup
  // (all typed) gains nothing. The workflow/hosted-link can also switch handoff
  // off (`deviceHandoff: false`); default on.
  const captureNeeded = isBusiness
    ? snap.business?.applicant?.verification === true || snap.business?.documents?.enabled === true
    : snap.enableLiveness !== false || snap.enableDocumentCapture !== false;
  const cameraNeeded = snap.deviceHandoff !== false && captureNeeded;
  const serverConfigOverride: ServerSdkConfig = {
    status: 'ready',
    idTypes: bootstrap.idTypes,
    environment: bootstrap.environment,
    branding: bootstrap.branding,
  };

  return (
    <KYCProvider>
      <KYCConfigProvider
        apiKey={`${HANDOFF_TOKEN_PREFIX}${token}`}
        apiOverride={api}
        serverConfigOverride={serverConfigOverride}
        subjectType={snap.subjectType as SubjectType | undefined}
        business={snap.business as WorkflowBusinessConfig | undefined}
        // Business snapshots carry no top-level country — the registry country
        // stands in so the context never sees undefined.
        country={(snap.country ?? snap.business?.country) as AnyCountry}
        countries={snap.countries as Array<{ country: AnyCountry; idTypes?: AnyIdType[] }> | undefined}
        idTypes={snap.idTypes as AnyIdType[] | undefined}
        metadata={snap.metadata}
        userId={snap.userId}
        enableSelfie={snap.enableSelfie}
        enableDocumentCapture={snap.enableDocumentCapture}
        allowDocumentUpload={snap.allowDocumentUpload}
        enableLiveness={snap.enableLiveness}
        livenessMode={snap.livenessMode as 'gestures' | 'flash' | 'both' | undefined}
        deviceHandoff={snap.deviceHandoff}
        appearance={snap.appearance as KYCAppearance | undefined}
        consent={snap.consent as KYCConsentContent | undefined}
        success={snap.success as KYCSuccessContent | undefined}
        emailVerification={snap.emailVerification as EmailVerificationConfig | undefined}
        phoneVerification={snap.phoneVerification as PhoneVerificationConfig | undefined}
        questionnaire={snap.questionnaire as QuestionnaireConfig | undefined}
        proofOfAddress={snap.proofOfAddress as ProofOfAddressConfig | undefined}
        nfc={snap.nfc as NfcConfig | undefined}
        userData={snap.userData}
        assetsBasePath={snap.assetsBasePath}
      >
        <HostedFlowInner
          snapshot={snap}
          cameraNeeded={cameraNeeded}
          voiceGuidance={snap.voiceGuidance as VoiceGuidanceOption | undefined}
          // Business flows have no liveness step — never load the face model —
          // unless the workflow runs the applicant's own capture leg in-flow.
          enableLiveness={
            isBusiness && snap.business?.applicant?.verification !== true
              ? false
              : snap.enableLiveness
          }
          showThemeToggle={snap.showThemeToggle}
          fullScreen={snap.fullScreen}
        />
      </KYCConfigProvider>
    </KYCProvider>
  );
}

function HostedFlowInner({
  snapshot,
  cameraNeeded,
  voiceGuidance,
  enableLiveness,
  showThemeToggle,
  fullScreen,
}: {
  snapshot: HandoffSessionSnapshot;
  cameraNeeded: boolean;
  voiceGuidance?: VoiceGuidanceOption;
  enableLiveness?: boolean;
  showThemeToggle?: boolean;
  fullScreen?: boolean;
}) {
  const { state, dispatch } = useKYCContext();
  // A DESKTOP hosted-link visitor is offered the "continue on your phone" gate
  // first (the gate mints a CHILD handoff session for the phone and polls it).
  // A phone visitor — the common hosted case — or a no-camera flow goes straight
  // into the modal.
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (cameraNeeded && isDesktopDevice()) {
      setGateOpen(true);
    } else {
      dispatch({ type: 'OPEN_MODAL' });
    }
    if (enableLiveness !== false) primeFaceMesh();
    configureSpeech(voiceGuidance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verify on this computer instead: leave the gate, run the flow here.
  const continueHere = () => {
    setGateOpen(false);
    dispatch({ type: 'OPEN_MODAL' });
  };

  // On the phone there is nothing to "close" back to — the flow is the whole
  // page — so close is disabled. The terminal Submitted step ends the journey;
  // the desktop is notified via its session poll.
  return (
    <>
      {gateOpen && (
        <Suspense fallback={null}>
          <DeviceHandoffGate
            snapshot={snapshot}
            onContinueHere={continueHere}
            // No parent surface to return to on the hosted page — dismissing the
            // gate simply falls through to verifying on this device.
            onClose={continueHere}
            showThemeToggle={showThemeToggle}
          />
        </Suspense>
      )}
      <KYCModal open={state.isOpen} onClose={() => undefined} showThemeToggle={showThemeToggle} disableClose fullScreen={fullScreen} />
    </>
  );
}
