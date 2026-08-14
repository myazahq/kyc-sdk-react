'use client';

import React, { useEffect, useState } from 'react';
import { buildThemeVars } from '../lib/theme';
import { applyConfiguredTheme } from '../lib/apply-theme';
import { ThemeVarsContext } from '../lib/theme-context';
import { useIsDark } from '../lib/use-is-dark';
import { useBrandFonts } from '../lib/use-brand-fonts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { KYCHeader } from './KYCHeader';
import { SandboxBanner } from './SandboxBanner';
import { StepHeaderSlotContext } from './step-header-slot';
import { CaptureLightContext } from './capture-light';
import { ImmersiveCaptureContext } from './immersive-capture';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { hasActiveQuestionnaire } from '../lib/questionnaire';
import { hasProofOfAddressStep } from '../lib/post-capture';
import { hasEmailVerificationStep, hasPhoneVerificationStep } from '../lib/contact-steps';
import { isBusinessFlow } from '../lib/business';
import { getStepPosition } from '../lib/step-order';
import { ProofOfAddressStep } from '../steps/ProofOfAddressStep';
import type { KYCStep } from '../types/config';
import { PoweredBy } from './PoweredBy';
import { VisuallyHidden } from './VisuallyHidden';
import { KYCErrorBoundary } from './KYCErrorBoundary';

import { ApplicantRoleStep } from '../steps/ApplicantRoleStep';
import { BusinessDetailsStep } from '../steps/BusinessDetailsStep';
import { BusinessDocumentsStep } from '../steps/BusinessDocumentsStep';
import { BusinessKeyPeopleStep } from '../steps/BusinessKeyPeopleStep';
import { ConsentStep } from '../steps/ConsentStep';
import { ContactVerificationStep } from '../steps/ContactVerificationStep';
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
// Step ordering — buildStepOrder/getStepProgress live in lib/step-order.ts
// (KYB application steps + the individual flow paths).
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
    // Distinct keys are LOAD-BEARING: both mounts are the same component type
    // at the same position, so without them React reuses the instance when the
    // flow moves email → phone. The phone step would open holding the email
    // step's challengeId, show its code panel, and verifying would file the
    // EMAIL proof as the phone token — which the server then drops, blocking
    // submission on a phone check the user appears to have passed.
    case 'email-verification':
      return <ContactVerificationStep key="contact-email" channel="email" />;
    case 'phone-verification':
      return <ContactVerificationStep key="contact-phone" channel="phone" />;
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
    case 'business-key-people':
      return <BusinessKeyPeopleStep />;
    case 'business-documents':
      return <BusinessDocumentsStep />;
    case 'applicant-role':
      return <ApplicantRoleStep />;
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
  // Capture steps light the screen by whitening the backdrop. A step may
  // override that for part of its run — flash liveness only wants it while the
  // sequence is emitting. null = no opinion, use the default.
  const [lightOverride, setLightOverride] = useState<boolean | null>(null);
  const isCaptureStep = CAPTURE_STEPS.includes(state.currentStep);
  const litForCapture = lightOverride ?? isCaptureStep;
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
  const hasEmailVerification = hasEmailVerificationStep(config.emailVerification);
  const hasPhoneVerification = hasPhoneVerificationStep(config.phoneVerification);
  const [expanded, setExpanded] = useState(false);
  // `fullScreen` (config) forces the fullscreen layout on every device and
  // hides the expand/collapse control; otherwise the user toggles it.
  const fullscreen = fullScreen === true || expanded;
  const isDarkTheme = useIsDark();
  const themeVars = buildThemeVars(config.appearance, isDarkTheme);
  useBrandFonts(config.appearance);
  // A fatal config-load failure (e.g. wrong API key) blocks the whole flow.
  const configError =
    config.serverConfig.status === 'error' && config.serverConfig.fatal
      ? config.serverConfig.error ?? 'Unable to start verification. Please try again.'
      : null;

  // Apply the configured initial light/dark mode — 'system' follows (and
  // tracks) the device preference. Runs on mount (and if the prop changes);
  // the in-flow ThemeToggle can still flip it during a session.
  useEffect(() => applyConfiguredTheme(config.appearance?.theme), [config.appearance?.theme]);

  // Header progress. The two styles are mutually exclusive: two indicators on
  // one header would be noise, and the point of the bar is that it costs no
  // height. Neither renders over the config-error screen, which has no flow to
  // be partway through.
  const stepOptions = {
    isBusiness,
    business: config.business,
    hasDocCapture,
    hasLiveness,
    hasCountrySelect,
    hasEmailVerification,
    hasPhoneVerification,
    hasPoa,
    hasQuestionnaire,
  };
  // index < 0 / total 0 means "nothing to draw" — the success screen, or a step
  // that isn't part of this flow. Mirrors the RN SDK's stepInfo.
  const { index: stepIndex, total: stepCount } = getStepPosition(state.currentStep, stepOptions);
  const stepFraction = stepCount > 0 ? (stepIndex + 1) / stepCount : 0;
  // The header's title row. Steps portal their StepHeader into it, so the
  // title sits in the header block exactly as it does on RN and Flutter.
  const [titleSlot, setTitleSlot] = useState<HTMLDivElement | null>(null);
  // 'none' omits progress from the header entirely: it turns showProgress off,
  // so both the step row and the bar drop out and the header keeps its bottom
  // border (the bar is what normally replaces it). KYCHeader needs no change.
  // A live document camera takes the whole surface (see immersive-capture.ts).
  // Reset on step change so a step that unmounts mid-capture — a back gesture,
  // an error boundary — can never strand the chrome hidden.
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    setImmersive(false);
  }, [state.currentStep]);

  const progressStyle = config.progressStyle ?? 'steps';
  const asBar = progressStyle === 'bar';
  const showProgress =
    !configError && stepIndex >= 0 && stepCount > 0 && progressStyle !== 'none';

  return (
    // Portal-rendered surfaces (Select/Popover/Drawer) escape the modal root's
    // inline style, so they re-read the brand vars from this context.
    <ThemeVarsContext.Provider value={themeVars}>
    <StepHeaderSlotContext.Provider value={titleSlot}>
    <CaptureLightContext.Provider value={setLightOverride}>
    <ImmersiveCaptureContext.Provider value={setImmersive}>
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !dismissBlocked) onClose(); }}>
      <DialogContent
        fullscreen={fullscreen}
        overlayClassName={litForCapture ? 'bg-white' : undefined}
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
          {!immersive && <SandboxBanner />}
          {!immersive && <KYCHeader
            showThemeToggle={showThemeToggle}
            dismissBlocked={dismissBlocked}
            onClose={onClose}
            fullScreen={fullScreen}
            fullscreen={fullscreen}
            onToggleExpand={() => setExpanded((f) => !f)}
            showProgress={showProgress}
            asBar={asBar}
            stepFraction={stepFraction}
            stepCount={stepCount}
            titleSlotRef={setTitleSlot}
          />}

          <KYCErrorBoundary>
            {/* flex flex-col so a step that opts in (flex-1 + min-h-0, e.g. the
                country picker) can fill this area and own its scroll; content
                steps stay content-height and this container scrolls them. */}
            <div className={cn(
              'flex min-h-0 flex-1 flex-col animate-slide-up',
              // Immersive: no padding, no scroll, no centred column — the step
              // is a full-bleed camera and owns every pixel.
              immersive
                ? 'overflow-hidden'
                : 'overflow-y-auto p-6',
              !immersive && fullscreen && 'xl:mx-auto xl:w-full xl:max-w-2xl',
            )} key={configError ? 'config-error' : state.currentStep}>
              {configError ? (
                <ConfigErrorScreen message={configError} onClose={onClose} />
              ) : (
                <CurrentStep />
              )}
            </div>
          </KYCErrorBoundary>

          {/* Vendor attribution. Sits OUTSIDE the scrolling body as a shrink-0
              sibling, so it stays pinned while a long step scrolls under it.
              Dropped in immersive capture, where the camera owns the surface. */}
          {!immersive && <PoweredBy />}
        </div>
      </DialogContent>
    </Dialog>
    </ImmersiveCaptureContext.Provider>
    </CaptureLightContext.Provider>
    </StepHeaderSlotContext.Provider>
    </ThemeVarsContext.Provider>
  );
}
