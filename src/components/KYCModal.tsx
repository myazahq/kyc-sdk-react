'use client';

import React, { useEffect, useReducer, useState } from 'react';
import { useBranding } from '../hooks/useBranding';
import { buildThemeVars } from '../lib/theme';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Maximize2, Minimize2, Moon, Sun, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { hasActiveQuestionnaire } from '../lib/questionnaire';
import { hasProofOfAddressStep } from '../lib/post-capture';
import { isBusinessFlow } from '../lib/business';
import { ProofOfAddressStep } from '../steps/ProofOfAddressStep';
import type { KYCStep } from '../types/config';
import { VisuallyHidden } from './VisuallyHidden';
import { KYCErrorBoundary } from './KYCErrorBoundary';

import { BusinessDetailsStep } from '../steps/BusinessDetailsStep';
import { ConsentStep } from '../steps/ConsentStep';
import { CountrySelectStep } from '../steps/CountrySelectStep';
import { IdTypeStep } from '../steps/IdTypeStep';
import { IdInputStep } from '../steps/IdInputStep';
import { DocumentCaptureStep } from '../steps/DocumentCaptureStep';
import { LivenessStep } from '../steps/LivenessStep';
import { NfcStep } from '../steps/NfcStep';
import { QuestionnaireStep } from '../steps/QuestionnaireStep';
import { PreviewCapturePlaceholder } from '../steps/PreviewCapturePlaceholder';
import { SubmittedStep } from '../steps/SubmittedStep';

interface KYCModalProps {
  open: boolean;
  onClose: () => void;
  showThemeToggle?: boolean;
  /** Hide the close button and block all user-initiated dismissal. */
  disableClose?: boolean;
  /** Force fullscreen on all devices (hides the expand toggle). */
  fullScreen?: boolean;
}

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

function ThemeToggle() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('myaza-kyc-theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
    rerender();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Header brand — org logo + name, top-left, persistent on every step
// ---------------------------------------------------------------------------

function HeaderBrand() {
  const { logo, companyName } = useBranding();
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logo) && !failed;

  return (
    <div className="flex min-w-0 items-center gap-2">
      {showLogo && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-black/5">
          <img
            src={logo}
            alt={companyName ? `${companyName} logo` : 'Company logo'}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        </div>
      )}
      {showLogo && companyName && (
        <span className="truncate text-sm font-semibold text-foreground">{companyName}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step ordering — 5 steps each flow path
// ---------------------------------------------------------------------------

function buildStepOrder(
  isBusiness: boolean,
  hasDocCapture: boolean,
  hasLiveness: boolean,
  hasCountrySelect: boolean,
  hasPoa: boolean,
  hasQuestionnaire: boolean,
): KYCStep[] {
  // Business (KYB) flow — no id-type, no capture, no liveness, no PoA.
  if (isBusiness) {
    return ['consent', 'business-details', ...(hasQuestionnaire ? (['questionnaire'] as KYCStep[]) : []), 'submitted'];
  }
  const middle: KYCStep[] = hasDocCapture ? ['document-capture'] : ['id-input'];
  if (hasLiveness) middle.push('liveness');
  if (hasPoa) middle.push('proof-of-address');
  if (hasQuestionnaire) middle.push('questionnaire');
  return ['consent', ...(hasCountrySelect ? (['country-select'] as KYCStep[]) : []), 'id-type', ...middle, 'submitted'];
}

function getStepProgress(
  step: KYCStep,
  isBusiness: boolean,
  hasDocCapture: boolean,
  hasLiveness: boolean,
  hasCountrySelect: boolean,
  hasPoa: boolean,
  hasQuestionnaire: boolean,
): number {
  const order = buildStepOrder(isBusiness, hasDocCapture, hasLiveness, hasCountrySelect, hasPoa, hasQuestionnaire);
  // The preview-only nfc step sits right after document capture in the mobile
  // flow — borrow that slot so the progress bar reads sensibly.
  const index = order.indexOf(step === 'nfc' ? 'document-capture' : step);
  if (index === -1) return 0;
  return Math.round(((index + 1) / order.length) * 100);
}

// ---------------------------------------------------------------------------
// Config error screen — shown when the SDK can't load its server config because
// of a fatal auth failure (e.g. a wrong API key). Blocks the flow so the user
// gets a clear message instead of a silently broken ID-type list.
// ---------------------------------------------------------------------------

function ConfigErrorScreen({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <svg
          className="h-10 w-10 text-destructive"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold font-heading">Unable to start verification</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>

      <Button className="w-full" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

function CurrentStep() {
  const { state } = useKYCContext();
  const config = useKYCConfig();

  switch (state.currentStep) {
    case 'consent':
      return <ConsentStep />;
    case 'country-select':
      return <CountrySelectStep />;
    case 'id-type':
      return <IdTypeStep country={config.country} allowedIdTypes={config.idTypes} />;
    case 'document-capture':
      // Preview mode never touches the camera — a static placeholder stands in
      // for the capture steps (the flow stays walkable via its Continue).
      return config.previewMode ? <PreviewCapturePlaceholder kind="document" /> : <DocumentCaptureStep />;
    case 'id-input':
      return <IdInputStep />;
    case 'nfc':
      // Never in the WEB flow order (browsers can't do ISO-DEP) — reached only
      // via the builder preview's previewStep, standing in for the mobile SDK's
      // visually-identical chip-read screen.
      return <NfcStep />;
    case 'business-details':
      return <BusinessDetailsStep />;
    case 'liveness':
      return config.previewMode ? <PreviewCapturePlaceholder kind="liveness" /> : <LivenessStep />;
    case 'proof-of-address':
      return <ProofOfAddressStep />;
    case 'questionnaire':
      return <QuestionnaireStep />;
    case 'submitted':
      return <SubmittedStep />;
  }
}

const CAPTURE_STEPS: KYCStep[] = ['document-capture', 'liveness'];

export function KYCModal({ open, onClose, showThemeToggle, disableClose, fullScreen }: KYCModalProps) {
  const { state } = useKYCContext();
  const config = useKYCConfig();
  const isTerminal = state.currentStep === 'submitted';
  // The flow can't be dismissed on the terminal step, or when the consumer
  // disables close (programmatic close() is then the only way out).
  const dismissBlocked = isTerminal || disableClose === true;
  const isCaptureStep = CAPTURE_STEPS.includes(state.currentStep);
  const isBusiness = isBusinessFlow(config);
  const selectedDef = state.selectedIdType ? config.getIdTypeDefinition(state.selectedIdType) : null;
  const hasDocCapture = selectedDef ? selectedDef.requiresDocumentCapture : true;
  const hasCountrySelect = (config.countries?.length ?? 0) > 1;
  const livenessFeatures = state.selectedIdType
    ? config.getIdTypeFeatures(config.country, state.selectedIdType)
    : null;
  // The selfie/liveness step is present only when Presence Intelligence is on
  // (`enableSelfie !== false`). With it on, the server feature flag (or the
  // legacy `enableLiveness` prop) decides whether liveness gestures run.
  const hasLiveness =
    config.enableSelfie !== false &&
    (livenessFeatures ? livenessFeatures.livenessCheck : config.enableLiveness !== false);
  const hasQuestionnaire = hasActiveQuestionnaire(config.questionnaire);
  const hasPoa = hasProofOfAddressStep(config.proofOfAddress);
  const [expanded, setExpanded] = useState(false);
  // `fullScreen` (config) forces the fullscreen layout on every device and
  // hides the expand/collapse control; otherwise the user toggles it.
  const fullscreen = fullScreen === true || expanded;
  const themeVars = buildThemeVars(config.appearance);
  // A fatal config-load failure (e.g. wrong API key) blocks the whole flow.
  const configError =
    config.serverConfig.status === 'error' && config.serverConfig.fatal
      ? config.serverConfig.error ?? 'Unable to start verification. Please try again.'
      : null;

  // Apply the configured initial light/dark mode. Runs on mount (and if the
  // prop changes); the in-flow ThemeToggle can still flip it during a session.
  useEffect(() => {
    const theme = config.appearance?.theme;
    if (theme) document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [config.appearance?.theme]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !dismissBlocked) onClose(); }}>
      <DialogContent
        fullscreen={fullscreen}
        overlayClassName={isCaptureStep ? 'bg-white' : undefined}
        className="kyc-root"
        style={themeVars}
        onPointerDownOutside={(e) => { if (dismissBlocked) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (dismissBlocked) e.preventDefault(); }}
      >
        <VisuallyHidden>
          <DialogTitle>Identity Verification</DialogTitle>
          <DialogDescription>Verify your identity with Myaza</DialogDescription>
        </VisuallyHidden>

        <div className="flex h-full flex-col overflow-hidden rounded-[inherit]">
          <div className="relative shrink-0">
            {!configError && (
              <Progress value={getStepProgress(state.currentStep, isBusiness, hasDocCapture, hasLiveness, hasCountrySelect, hasPoa, hasQuestionnaire)} className="absolute inset-x-0 top-0 z-10 rounded-none" />
            )}

            {/* Header row — org brand top-left, controls top-right.
                Top padding gives the controls breathing room; safe-area aware
                so they also clear the status bar / notch on mobile. */}
            <div className="relative flex min-h-12 items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
              <HeaderBrand />

              <div className="flex shrink-0 items-center gap-1">
                {showThemeToggle !== false && <ThemeToggle />}

                {/* Mobile close button — hidden on submitted step or when close is disabled */}
                {!dismissBlocked && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex xl:hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {/* Expand / collapse toggle — desktop only; hidden when the
                    flow is forced fullscreen */}
                {fullScreen !== true && (
                <button
                  type="button"
                  onClick={() => setExpanded((f) => !f)}
                  className="hidden xl:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                )}
              </div>
            </div>
          </div>

          <KYCErrorBoundary>
            {/* flex flex-col so a step that opts in (flex-1 + min-h-0, e.g. the
                country picker) can fill this area and own its scroll; content
                steps stay content-height and this container scrolls them. */}
            <div className={cn(
              'flex min-h-0 flex-1 flex-col overflow-y-auto p-6 animate-slide-up',
              fullscreen && 'xl:mx-auto xl:w-full xl:max-w-2xl',
            )} key={configError ? 'config-error' : state.currentStep}>
              {configError ? (
                <ConfigErrorScreen message={configError} onClose={onClose} />
              ) : (
                <CurrentStep />
              )}
            </div>
          </KYCErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  );
}
