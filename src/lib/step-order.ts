// ---------------------------------------------------------------------------
// Flow step ordering + progress accounting (extracted from KYCModal per the
// 200-line rule). Individual flows: consent → (country-select) → id-type →
// capture → (liveness) → (poa) → (questionnaire) → submitted. Business (KYB)
// flows: consent → business-details → (business-key-people) →
// (business-documents) → (applicant capture leg) → (questionnaire) → submitted.
// ---------------------------------------------------------------------------

import type { KYCStep } from '../types/config';
import type { WorkflowBusinessConfig } from '../types/business';
import { businessSectionSteps, hasApplicantVerification } from './business-application';

export interface StepOrderOptions {
  isBusiness: boolean;
  /** Business (KYB) configuration — drives the application-section steps. */
  business?: WorkflowBusinessConfig;
  hasDocCapture: boolean;
  hasLiveness: boolean;
  hasCountrySelect: boolean;
  hasEmailVerification: boolean;
  hasPhoneVerification: boolean;
  hasPoa: boolean;
  hasQuestionnaire: boolean;
}

// Contact-verification OTP steps sit right after consent (both flows) — a
// cheap pre-filter before capture/registry spend; email before phone.
function contactSteps(o: StepOrderOptions): KYCStep[] {
  return [
    ...(o.hasEmailVerification ? (['email-verification'] as KYCStep[]) : []),
    ...(o.hasPhoneVerification ? (['phone-verification'] as KYCStep[]) : []),
  ];
}

export function buildStepOrder(o: StepOrderOptions): KYCStep[] {
  // Business (KYB) flow — the application section, then (when the workflow
  // requires applicant verification) the ordinary individual capture leg.
  if (o.isBusiness) {
    const steps: KYCStep[] = ['consent', ...contactSteps(o), ...businessSectionSteps(o.business)];
    if (hasApplicantVerification(o.business)) {
      steps.push('id-type', o.hasDocCapture ? 'document-capture' : 'id-input');
      if (o.hasLiveness) steps.push('liveness');
    }
    if (o.hasQuestionnaire) steps.push('questionnaire');
    steps.push('submitted');
    return steps;
  }
  const middle: KYCStep[] = [o.hasDocCapture ? 'document-capture' : 'id-input'];
  if (o.hasLiveness) middle.push('liveness');
  if (o.hasPoa) middle.push('proof-of-address');
  if (o.hasQuestionnaire) middle.push('questionnaire');
  return [
    'consent',
    ...contactSteps(o),
    ...(o.hasCountrySelect ? (['country-select'] as KYCStep[]) : []),
    'id-type',
    ...middle,
    'submitted',
  ];
}

/**
 * Where a step sits in the flow, for the header's progress indicator.
 *
 * `index` is -1 (and `total` 0) when there is no progress to draw, which the
 * header reads as "render nothing".
 *
 * `submitted` is deliberately excluded on BOTH counts, matching the RN and
 * Flutter SDKs:
 *
 *   • The success screen shows no indicator at all — the flow is over, so a
 *     progress row there is noise.
 *   • It is not counted as a step either. Counting it inflated every flow by
 *     one and meant the last thing the user actually did could never reach the
 *     end of the row: a 4-step flow read "1 of 5" and topped out at 4/5.
 */
export interface StepPosition {
  index: number;
  total: number;
}

const NO_PROGRESS: StepPosition = { index: -1, total: 0 };

export function getStepPosition(step: KYCStep, o: StepOrderOptions): StepPosition {
  if (step === 'submitted') return NO_PROGRESS;
  const steps = buildStepOrder(o).filter((s) => s !== 'submitted');
  // The preview-only nfc step sits right after document capture in the mobile
  // flow — borrow that slot so progress reads sensibly.
  const index = steps.indexOf(step === 'nfc' ? 'document-capture' : step);
  if (index < 0) return NO_PROGRESS;
  return { index, total: steps.length };
}
