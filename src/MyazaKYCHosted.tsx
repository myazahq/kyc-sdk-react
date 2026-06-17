'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { KYCProvider, useKYCContext } from './context/KYCContext';
import { KYCConfigProvider, type ServerSdkConfig } from './context/KYCConfigContext';
import { KYCModal } from './components/KYCModal';
import { buildThemeVars } from './lib/theme';
import { primeFaceMesh } from './liveness/face-mesh';
import { configureSpeech } from './liveness/speech';
import { createKYCApi, type HandoffBootstrapResponse, type KYCApi } from './services/api';
import type {
  SupportedCountry,
  IdType,
  KYCAppearance,
  KYCConsentContent,
  KYCSuccessContent,
  VoiceGuidanceOption,
} from './types/config';

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
        country={snap.country as SupportedCountry}
        idTypes={snap.idTypes as IdType[] | undefined}
        metadata={snap.metadata}
        enableSelfie={snap.enableSelfie}
        enableDocumentCapture={snap.enableDocumentCapture}
        allowDocumentUpload={snap.allowDocumentUpload}
        enableLiveness={snap.enableLiveness}
        appearance={snap.appearance as KYCAppearance | undefined}
        consent={snap.consent as KYCConsentContent | undefined}
        success={snap.success as KYCSuccessContent | undefined}
        userData={snap.userData}
        assetsBasePath={snap.assetsBasePath}
        deviceHandoff={false}
      >
        <HostedFlowInner
          voiceGuidance={snap.voiceGuidance as VoiceGuidanceOption | undefined}
          enableLiveness={snap.enableLiveness}
          showThemeToggle={snap.showThemeToggle}
        />
      </KYCConfigProvider>
    </KYCProvider>
  );
}

function HostedFlowInner({
  voiceGuidance,
  enableLiveness,
  showThemeToggle,
}: {
  voiceGuidance?: VoiceGuidanceOption;
  enableLiveness?: boolean;
  showThemeToggle?: boolean;
}) {
  const { dispatch } = useKYCContext();

  useEffect(() => {
    dispatch({ type: 'OPEN_MODAL' });
    if (enableLiveness !== false) primeFaceMesh();
    configureSpeech(voiceGuidance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On the phone there is nothing to "close" back to — the flow is the whole
  // page — so close is disabled. The terminal Submitted step ends the journey;
  // the desktop is notified via its session poll.
  return <KYCModal open onClose={() => undefined} showThemeToggle={showThemeToggle} disableClose />;
}
