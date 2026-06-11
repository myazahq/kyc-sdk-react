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
import { requiresDocumentCapture } from '../utils/countries';
import type { KYCStep } from '../types/config';
import { VisuallyHidden } from './VisuallyHidden';
import { KYCErrorBoundary } from './KYCErrorBoundary';

import { ConsentStep } from '../steps/ConsentStep';
import { IdTypeStep } from '../steps/IdTypeStep';
import { IdInputStep } from '../steps/IdInputStep';
import { DocumentCaptureStep } from '../steps/DocumentCaptureStep';
import { LivenessStep } from '../steps/LivenessStep';
import { SubmittedStep } from '../steps/SubmittedStep';

interface KYCModalProps {
  open: boolean;
  onClose: () => void;
  showThemeToggle?: boolean;
  /** Hide the close button and block all user-initiated dismissal. */
  disableClose?: boolean;
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
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
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

function buildStepOrder(hasDocCapture: boolean, hasLiveness: boolean): KYCStep[] {
  const middle: KYCStep[] = hasDocCapture ? ['document-capture'] : ['id-input'];
  if (hasLiveness) middle.push('liveness');
  return ['consent', 'id-type', ...middle, 'submitted'];
}

function getStepProgress(step: KYCStep, hasDocCapture: boolean, hasLiveness: boolean): number {
  const order = buildStepOrder(hasDocCapture, hasLiveness);
  const index = order.indexOf(step);
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
    case 'id-type':
      return <IdTypeStep country={config.country} allowedIdTypes={config.idTypes} />;
    case 'document-capture':
      return <DocumentCaptureStep />;
    case 'id-input':
      return <IdInputStep />;
    case 'liveness':
      return <LivenessStep />;
    case 'submitted':
      return <SubmittedStep />;
  }
}

const CAPTURE_STEPS: KYCStep[] = ['document-capture', 'liveness'];

export function KYCModal({ open, onClose, showThemeToggle, disableClose }: KYCModalProps) {
  const { state } = useKYCContext();
  const config = useKYCConfig();
  const isTerminal = state.currentStep === 'submitted';
  // The flow can't be dismissed on the terminal step, or when the consumer
  // disables close (programmatic close() is then the only way out).
  const dismissBlocked = isTerminal || disableClose === true;
  const isCaptureStep = CAPTURE_STEPS.includes(state.currentStep);
  const hasDocCapture = state.selectedIdType ? requiresDocumentCapture(state.selectedIdType) : true;
  const livenessFeatures = state.selectedIdType
    ? config.getIdTypeFeatures(config.country, state.selectedIdType)
    : null;
  const hasLiveness = livenessFeatures
    ? livenessFeatures.livenessCheck
    : config.enableLiveness !== false;
  const [fullscreen, setFullscreen] = useState(false);
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
              <Progress value={getStepProgress(state.currentStep, hasDocCapture, hasLiveness)} className="absolute inset-x-0 top-0 z-10 rounded-none" />
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

                {/* Expand / collapse toggle — desktop only */}
                <button
                  type="button"
                  onClick={() => setFullscreen((f) => !f)}
                  className="hidden xl:flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <KYCErrorBoundary>
            <div className={cn(
              'flex-1 overflow-y-auto p-6 animate-slide-up',
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
