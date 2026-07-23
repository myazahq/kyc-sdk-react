'use client';

import React, { useEffect, useMemo, useState, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { createKYCApi, KYCApiError, type BiometricAuthResponse } from './services/api';
import { resolveBaseUrl } from './lib/resolve-url';
import { buildThemeVars } from './lib/theme';
import { KYCError } from './types/verification';
import type { KYCAppearance } from './types/config';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './components/ui/dialog';
import { VisuallyHidden } from './components/VisuallyHidden';
import { BiometricLivenessCapture } from './components/BiometricLivenessCapture';

// ---------------------------------------------------------------------------
// MyazaBiometricAuth — returning-user face re-authentication ("prove it's still
// you"). A verified user re-authenticates with a live selfie matched 1:1 against
// their KYC enrollment selfie (no gov-DB call, no re-KYC). Self-contained: its
// own trigger button + modal + a small intro → capture → result state machine.
// ---------------------------------------------------------------------------

export interface MyazaBiometricAuthConfig {
  /** Publishable API key (`pk_…`). The environment is derived from its prefix. */
  apiKey: string;
  /** Override the server URL for development keys (default http://localhost:3001). */
  devUrl?: string;
  /** The org's user reference (Entity.externalUserId) to re-authenticate. */
  externalUserId: string;
  /** Presence Intelligence method (default 'gestures'). */
  livenessMode?: 'gestures' | 'flash' | 'both';
  appearance?: KYCAppearance;
  assetsBasePath?: string;
  disableClose?: boolean;
  /** Open the modal on mount (skip the trigger button). */
  defaultOpen?: boolean;
  /** Fired when the modal opens. */
  onOpen?: () => void;
  /** The user re-authenticated. `token` is a single-use proof (verify from your
   *  backend with a secret key at `/biometric/verify-proof`). */
  onAuthenticated?: (result: { attemptId: string; confidence: number | null; token?: string }) => void;
  /** The check ran but the user did not pass (no match / liveness failed). */
  onFailed?: (result: { status: BiometricAuthResponse['status']; attemptId: string; confidence: number | null }) => void;
  /** A technical error (network, not enrolled, insufficient credits, …). */
  onError?: (error: KYCError) => void;
  onClose?: () => void;
}

export type MyazaBiometricAuthProps = MyazaBiometricAuthConfig &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MyazaBiometricAuthConfig | 'onClick'>;

type View = 'intro' | 'capture' | 'authenticating' | 'result';
type Outcome =
  | { kind: 'success'; result: BiometricAuthResponse }
  | { kind: 'failed'; result: BiometricAuthResponse }
  | { kind: 'error'; message: string };

function base64ToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function mapAuthError(err: unknown): KYCError {
  if (err instanceof KYCApiError) {
    if (err.statusCode === 404 && err.code === 'not_enrolled') {
      return new KYCError('unknown', "You're not set up for face verification yet.");
    }
    if (err.statusCode === 402) {
      return new KYCError('insufficient_credits', 'Face verification is temporarily unavailable.');
    }
    if (err.statusCode === 401 || err.statusCode === 403) {
      return new KYCError('invalid_api_key', 'This app is not authorized for face verification.');
    }
  }
  return new KYCError('network_error', 'Something went wrong. Please try again.');
}

export function MyazaBiometricAuth({
  apiKey,
  devUrl,
  externalUserId,
  livenessMode = 'gestures',
  appearance,
  assetsBasePath,
  disableClose,
  defaultOpen,
  onOpen,
  onAuthenticated,
  onFailed,
  onError,
  onClose,
  children,
  ...triggerProps
}: MyazaBiometricAuthProps) {
  const api = useMemo(() => createKYCApi(resolveBaseUrl(apiKey, devUrl), apiKey), [apiKey, devUrl]);
  const themeVars = buildThemeVars(appearance);

  const [open, setOpen] = useState(defaultOpen ?? false);
  const [view, setView] = useState<View>('intro');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    const theme = appearance?.theme;
    if (open && theme) document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [open, appearance?.theme]);

  const handleOpen = () => {
    setOutcome(null);
    setView('intro');
    setOpen(true);
    onOpen?.();
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleCaptured = async (selfieBase64: string) => {
    setView('authenticating');
    try {
      const mediaId = await api.upload(base64ToBlob(selfieBase64), 'selfie');
      const result = await api.authenticate({
        externalUserId,
        selfie: mediaId,
        liveness: { mode: livenessMode, passed: true },
      });
      if (result.authenticated) {
        setOutcome({ kind: 'success', result });
        onAuthenticated?.({ attemptId: result.attemptId, confidence: result.confidence, token: result.token });
      } else {
        setOutcome({ kind: 'failed', result });
        onFailed?.({ status: result.status, attemptId: result.attemptId, confidence: result.confidence });
      }
    } catch (err) {
      const kyc = mapAuthError(err);
      setOutcome({ kind: 'error', message: kyc.message });
      onError?.(kyc);
    } finally {
      setView('result');
    }
  };

  const retry = () => {
    setOutcome(null);
    setView('capture');
  };

  const dismissBlocked = disableClose === true || view === 'authenticating';

  return (
    <>
      {defaultOpen !== true && (
        <Button type="button" style={themeVars} onClick={handleOpen} {...triggerProps}>
          {children ?? "Verify it's you"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o && !dismissBlocked) handleClose(); }}>
        <DialogContent
          className="kyc-root"
          style={themeVars}
          onPointerDownOutside={(e) => { if (dismissBlocked) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (dismissBlocked) e.preventDefault(); }}
        >
          <VisuallyHidden>
            <DialogTitle>Face re-authentication</DialogTitle>
            <DialogDescription>Confirm it's you with a quick face check</DialogDescription>
          </VisuallyHidden>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
            {view === 'intro' && (
              <IntroScreen onStart={() => setView('capture')} />
            )}

            {view === 'capture' && (
              <BiometricLivenessCapture
                livenessMode={livenessMode}
                assetsBasePath={assetsBasePath}
                onComplete={handleCaptured}
                onError={onError}
              />
            )}

            {view === 'authenticating' && <AuthenticatingScreen />}

            {view === 'result' && outcome && (
              <ResultScreen outcome={outcome} onRetry={retry} onClose={handleClose} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-6 animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <svg className="h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </svg>
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold font-heading">Verify it's you</h2>
        <p className="text-sm text-muted-foreground">
          We'll take a quick face check to confirm your identity — no documents needed.
        </p>
      </div>
      <Button className="w-full" onClick={onStart}>
        Start
      </Button>
    </div>
  );
}

function AuthenticatingScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12 animate-fade-in">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 rounded-full border-2 border-primary/30 animate-pulse-ring" />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-base font-medium">Verifying it's you…</p>
        <p className="text-sm text-muted-foreground">This only takes a moment.</p>
      </div>
    </div>
  );
}

function ResultScreen({ outcome, onRetry, onClose }: { outcome: Outcome; onRetry: () => void; onClose: () => void }) {
  if (outcome.kind === 'success') {
    return (
      <div className="flex flex-col items-center gap-6 py-6 animate-fade-in">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--kyc-success)]/10">
          <svg className="h-10 w-10 text-[var(--kyc-success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12l5 5L20 6" strokeDasharray="100" strokeDashoffset="100" className="animate-checkmark" />
          </svg>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold font-heading">You're verified</h2>
          <p className="text-sm text-muted-foreground">We confirmed it's really you.</p>
        </div>
        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    );
  }

  const message =
    outcome.kind === 'failed'
      ? "We couldn't confirm it's you. Make sure your face is clear and well lit, then try again."
      : outcome.message;

  return (
    <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <svg className="h-10 w-10 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold font-heading">
          {outcome.kind === 'failed' ? "Couldn't verify you" : 'Something went wrong'}
        </h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Button className="w-full" onClick={onRetry}>
        Try Again
      </Button>
      <Button variant="ghost" className="w-full" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
