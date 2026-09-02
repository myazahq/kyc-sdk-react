'use client';

import { configScope, isFaceScope } from '../lib/scope';
import React from 'react';
import {
  ShieldCheck,
  BadgeCheck,
  Building2,
  FileText,
  UserRound,
  UsersRound,
  ScanLine,
  ScanFace,
  Lock,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { isBusinessFlow } from '../lib/business';
import { firstStepAfterConsent, hasEmailVerificationStep, hasPhoneVerificationStep } from '../lib/contact-steps';
import { resubmitNote } from '../lib/resubmit';
import { hasActiveQuestionnaire } from '../lib/questionnaire';
import { hasAddressCollectionStep, hasProofOfAddressStep } from '../lib/post-capture';
import {
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
} from '../lib/business-application';
import { MobileHandoffSheet } from '../components/MobileHandoffSheet';
import { fillTokens } from '../lib/tokens';
import { PRIVACY_URL, TERMS_URL } from '../lib/brand';

interface ProcessStep {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

const DEFAULT_CONSENT_DESCRIPTION =
  'We need to verify your identity to comply with regulatory requirements. ' +
  'This process is quick and secure.';

const DEFAULT_BUSINESS_CONSENT_DESCRIPTION =
  'We need to verify your business to comply with regulatory requirements. ' +
  'This process is quick and secure.';

const SCOPE_TITLES: Record<string, string> = {
  address: 'Address Verification',
  'biometric-authentication': 'Face Check',
  'biometric-enrollment': 'Face Enrolment',
  questionnaire: 'A Few Questions',
  contact: 'Confirm Your Contact Details',
};

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  address:
    'We need to confirm your home address to comply with regulatory requirements. This process is quick and secure.',
  'biometric-authentication':
    'A quick face check confirms it is really you. This takes a few seconds and is secure.',
  'biometric-enrollment':
    'A quick selfie sets up face checks for next time, so you will not have to prove your identity again. This takes a few seconds and is secure.',
  questionnaire:
    'A few questions keep your account details up to date and help us comply with regulatory requirements.',
  contact:
    'We need to re-confirm the email address and phone number on your account. This takes a minute and is secure.',
};

const SCOPE_BULLETS: Record<string, ProcessStep[]> = {
  address: [
    { icon: MapPin, label: 'Pin your home address on a map' },
    { icon: BadgeCheck, label: 'Confirm the details only you can know' },
  ],
  'biometric-authentication': [
    { icon: ScanFace, label: 'Take a quick selfie with liveness checks' },
    { icon: BadgeCheck, label: 'We match it against your enrolled face' },
  ],
  'biometric-enrollment': [
    { icon: ScanFace, label: 'Take a quick selfie with liveness checks' },
    { icon: BadgeCheck, label: 'It becomes your face check for next time' },
  ],
  questionnaire: [
    { icon: BadgeCheck, label: 'Answer a few short questions' },
  ],
  contact: [
    { icon: Lock, label: 'Confirm your contact details with a one-time code' },
  ],
};

export function ConsentStep() {
  const { dispatch } = useKYCContext();
  const config = useKYCConfig();
  const isBusiness = isBusinessFlow(config);
  const scope = isBusiness ? null : configScope(config);
  const faceScope = isFaceScope(scope);
  const firstName = config.userData?.firstName;
  const lastName = config.userData?.lastName;
  // Business details aren't collected until after consent, so {businessName}
  // resolves here only when the integrator passes it in via userData.
  const businessName = config.userData?.businessName;
  const tokens = { firstName, lastName, businessName };

  const defaultTitle = firstName
    ? `Welcome, ${firstName}`
    : isBusiness
      ? 'Business Verification'
      : SCOPE_TITLES[scope ?? ''] ?? 'Identity Verification';
  const title = config.consent?.title
    ? fillTokens(config.consent.title, tokens)
    : defaultTitle;
  const description = config.consent?.description
    ? fillTokens(config.consent.description, tokens)
    : isBusiness
      ? DEFAULT_BUSINESS_CONSENT_DESCRIPTION
      : SCOPE_DESCRIPTIONS[scope ?? ''] ?? DEFAULT_CONSENT_DESCRIPTION;

  const handleContinue = () => {
    // Contact-verification steps (when enabled) come first — a cheap
    // pre-filter before capture/registry spend. Then business flows go to the
    // details form; multi-region individual flows pick the country; single-
    // region goes straight to the ID-type list.
    dispatch({
      type: 'SET_STEP',
      payload: firstStepAfterConsent({ ...config, subjectTypeIsBusiness: isBusiness }),
    });
  };

  // The consent notice must describe THIS flow, not the product. Claiming
  // facial recognition on a flow with no selfie step would be a false statement
  // in a legal notice — and the reverse (recording video without saying so) is
  // the failure that actually matters. Both are derived, never assumed.
  const capturesFace = isBusiness
    ? hasApplicantVerification(config.business)
    : faceScope || (!scope && config.enableSelfie !== false);
  const recordsVideo =
    capturesFace || (!isBusiness && !scope && config.enableDocumentCapture !== false);

  // Reflect the actually-enabled features so the list matches the real flow.
  const steps: ProcessStep[] = isBusiness
    ? [
        { icon: Building2, label: 'Collect your business registration details' },
        { icon: BadgeCheck, label: 'Verify your business against the official registry' },
      ]
    : scope
      ? // COPY the catalogue entry: steps.push below would otherwise mutate
        // the shared constant, appending one more bullet per re-render.
        [...SCOPE_BULLETS[scope]]
      : [
        { icon: BadgeCheck, label: 'Verify your government-issued ID' },
        { icon: UserRound, label: 'Collect basic personal information' },
      ];
  // On the CONTACT scope the catalogue bullet already says this — appending
  // the generic line showed "confirm your contact details" twice the moment
  // both channels were on.
  const hasEmail = hasEmailVerificationStep(config.emailVerification);
  const hasPhone = hasPhoneVerificationStep(config.phoneVerification);
  if (scope !== 'contact' && (hasEmail || hasPhone)) {
    const what = hasEmail && hasPhone ? 'email and phone number' : hasEmail ? 'email' : 'phone number';
    steps.push({ icon: Lock, label: `Confirm your ${what} with a one-time code` });
  }
  if (!isBusiness && !scope && config.enableDocumentCapture !== false) {
    steps.push({ icon: ScanLine, label: 'Capture a photo of your ID document' });
  }
  if (!isBusiness && !scope && config.enableSelfie !== false) {
    steps.push({ icon: ScanFace, label: 'Take a selfie for facial verification' });
  }
  // Post-capture features, in the order the flow runs them. Each is gated on
  // the flow that actually asks for it, and skipped where a scope's own
  // catalogue bullet already covers the same step.
  if (!isBusiness && hasProofOfAddressStep(config.proofOfAddress)) {
    steps.push({ icon: FileText, label: 'Upload a proof of address document' });
  }
  if (scope !== 'address' && hasAddressCollectionStep(config.addressCollection)) {
    steps.push({ icon: MapPin, label: 'Pin your address on a map' });
  }
  // The step-order predicate, not a raw fields check: a questionnaire with
  // questions but enabled: false never runs, so it must not be promised.
  if (scope !== 'questionnaire' && hasActiveQuestionnaire(config.questionnaire)) {
    steps.push({ icon: BadgeCheck, label: 'Answer a few short questions' });
  }
  if (isBusiness && hasKeyPeopleCollection(config.business)) {
    steps.push({ icon: UsersRound, label: "List the company's directors and owners" });
  }
  if (isBusiness && hasBusinessDocumentsStep(config.business)) {
    steps.push({ icon: FileText, label: 'Upload supporting business documents' });
  }
  if (isBusiness && hasApplicantVerification(config.business)) {
    steps.push({ icon: ScanFace, label: 'Verify your own identity' });
  }

  // A reviewer sent this applicant back. Say so, and say why — the note is the
  // only thing on screen that explains a flow which has silently lost most of
  // its steps. Rendered ABOVE the title so it is read before the instructions.
  const redoNote = resubmitNote(config.resubmit);

  return (
    <div className="space-y-7 animate-slide-up">
      {redoNote && (
        <div className="flex gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left">
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              A few things to redo
            </p>
            <p className="text-sm leading-relaxed text-foreground/80">{redoNote}</p>
          </div>
        </div>
      )}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-ring" />
          <span className="absolute inset-2 rounded-full bg-primary/15" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-semibold leading-tight font-heading">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-secondary/40 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          During this process we will
        </p>
        <ul className="mt-4 space-y-3.5">
          {steps.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-medium text-foreground/90">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {/* The notice sits IMMEDIATELY above the button it describes: consent is
            now given by acting, so the disclosure has to be adjacent to the act
            for that consent to be informed. */}
        <p className="pb-2 text-xs leading-relaxed text-muted-foreground">
          By tapping Continue, you agree to the{' '}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
            End User Terms
          </a>{' '}
          and{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
            Privacy Policy
          </a>
          , and consent to your{' '}
          {isBusiness ? 'business and personal data' : 'personal data'} being processed to
          verify your identity.
          {capturesFace && (
            <> This includes facial recognition and recording this session.</>
          )}
          {!capturesFace && recordsVideo && <> This includes recording this session.</>}
        </p>

        <Button onClick={handleContinue} className="w-full">
          Continue
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Your data is encrypted and securely processed
        </p>
        {/* No camera in the business flow — nothing to hand off to a phone for. */}
        {!isBusiness && (
          <div className="flex justify-center pt-1">
            <MobileHandoffSheet />
          </div>
        )}
      </div>
    </div>
  );
}
