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

export function KYCModal({ open, onClose, showThemeToggle }: KYCModalProps) {
  const { state } = useKYCContext();
  const config = useKYCConfig();
  const isTerminal = state.currentStep === 'submitted';
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

  // Apply the configured initial light/dark mode. Runs on mount (and if the
  // prop changes); the in-flow ThemeToggle can still flip it during a session.
  useEffect(() => {
    const theme = config.appearance?.theme;
    if (theme) document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [config.appearance?.theme]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !isTerminal) onClose(); }}>
      <DialogContent
        fullscreen={fullscreen}
        overlayClassName={isCaptureStep ? 'bg-white' : undefined}
        style={themeVars}
        onPointerDownOutside={(e) => { if (isTerminal) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isTerminal) e.preventDefault(); }}
      >
        <VisuallyHidden>
          <DialogTitle>Identity Verification</DialogTitle>
          <DialogDescription>Verify your identity with Myaza</DialogDescription>
        </VisuallyHidden>

        <div className="flex h-full flex-col overflow-hidden rounded-[inherit]">
          <div className="relative shrink-0">
            <Progress value={getStepProgress(state.currentStep, hasDocCapture, hasLiveness)} className="absolute inset-x-0 top-0 z-10 rounded-none" />

            {/* Header row — org brand top-left, controls top-right.
                Top padding gives the controls breathing room; safe-area aware
                so they also clear the status bar / notch on mobile. */}
            <div className="relative flex min-h-12 items-center justify-between gap-2 px-3 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
              <HeaderBrand />

              <div className="flex shrink-0 items-center gap-1">
                {showThemeToggle && <ThemeToggle />}

                {/* Mobile close button — hidden on submitted step */}
                {!isTerminal && (
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
            )} key={state.currentStep}>
              <CurrentStep />
            </div>
          </KYCErrorBoundary>
        </div>
      </DialogContent>
    </Dialog>
  );
}
