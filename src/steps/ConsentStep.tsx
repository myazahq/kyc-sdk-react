'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { cn } from '../lib/utils';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { isBusinessFlow } from '../lib/business';
import {
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
} from '../lib/business-application';
import { MobileHandoffSheet } from '../components/MobileHandoffSheet';

interface ProcessStep {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

/** Replaces {firstName} / {lastName} tokens with the user's data (or ''). */
function fillTokens(template: string, firstName?: string, lastName?: string): string {
  return template
    .replace(/\{firstName\}/g, firstName ?? '')
    .replace(/\{lastName\}/g, lastName ?? '')
    .trim();
}

const DEFAULT_CONSENT_DESCRIPTION =
  'We need to verify your identity to comply with regulatory requirements. ' +
  'This process is quick and secure.';

const DEFAULT_BUSINESS_CONSENT_DESCRIPTION =
  'We need to verify your business to comply with regulatory requirements. ' +
  'This process is quick and secure.';

export function ConsentStep() {
  const { dispatch } = useKYCContext();
  const config = useKYCConfig();
  const isBusiness = isBusinessFlow(config);
  const firstName = config.userData?.firstName;
  const lastName = config.userData?.lastName;
  const [consented, setConsented] = useState(false);

  const defaultTitle = firstName
    ? `Welcome, ${firstName}`
    : isBusiness
      ? 'Business Verification'
      : 'Identity Verification';
  const title = config.consent?.title
    ? fillTokens(config.consent.title, firstName, lastName)
    : defaultTitle;
  const description = config.consent?.description
    ? fillTokens(config.consent.description, firstName, lastName)
    : isBusiness
      ? DEFAULT_BUSINESS_CONSENT_DESCRIPTION
      : DEFAULT_CONSENT_DESCRIPTION;

  const handleContinue = () => {
    // Business (KYB) flows go straight to the details form. Multi-region
    // individual flows pick the country first; single-region skips straight
    // to the ID-type list.
    if (isBusiness) {
      dispatch({ type: 'SET_STEP', payload: 'business-details' });
      return;
    }
    const multiRegion = (config.countries?.length ?? 0) > 1;
    dispatch({ type: 'SET_STEP', payload: multiRegion ? 'country-select' : 'id-type' });
  };

  // Reflect the actually-enabled features so the list matches the real flow.
  const steps: ProcessStep[] = isBusiness
    ? [
        { icon: Building2, label: 'Collect your business registration details' },
        { icon: BadgeCheck, label: 'Verify your business against the official registry' },
      ]
    : [
        { icon: BadgeCheck, label: 'Verify your government-issued ID' },
        { icon: UserRound, label: 'Collect basic personal information' },
      ];
  if (!isBusiness && config.enableDocumentCapture !== false) {
    steps.push({ icon: ScanLine, label: 'Capture a photo of your ID document' });
  }
  if (!isBusiness && config.enableSelfie !== false) {
    steps.push({ icon: ScanFace, label: 'Take a selfie for facial verification' });
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

  return (
    <div className="space-y-7 animate-slide-up">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-ring" />
          <span className="absolute inset-2 rounded-full bg-primary/15" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
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

      <label
        htmlFor="consent"
        className={cn(
          'flex items-start gap-3 rounded-xl p-4 cursor-pointer transition-colors',
          consented ? 'bg-primary/5' : 'bg-secondary/40 hover:bg-secondary/60',
        )}
      >
        <Checkbox
          id="consent"
          checked={consented}
          onCheckedChange={(checked) => setConsented(checked === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="consent"
          className="text-sm leading-snug cursor-pointer font-normal"
        >
          {isBusiness
            ? 'I consent to the collection and processing of the provided business information for verification purposes.'
            : 'I consent to the collection and processing of my personal data for identity verification purposes.'}
        </Label>
      </label>

      <div className="space-y-3">
        <Button
          onClick={handleContinue}
          disabled={!consented}
          className="w-full"
        >
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
