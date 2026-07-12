import type { EmailVerificationConfig, KYCStep, PhoneVerificationConfig } from '../types/config';

// Contact-verification step presence + navigation helpers. The steps sit
// right after consent (a cheap pre-filter before document/liveness spend),
// email before phone when both are on.

export function hasEmailVerificationStep(cfg: EmailVerificationConfig | undefined | null): boolean {
  return cfg?.enabled === true;
}

export function hasPhoneVerificationStep(cfg: PhoneVerificationConfig | undefined | null): boolean {
  return cfg?.enabled === true;
}

interface ContactStepConfig {
  emailVerification?: EmailVerificationConfig;
  phoneVerification?: PhoneVerificationConfig;
  countries?: Array<{ country: string }>;
  subjectTypeIsBusiness: boolean;
}

/** The step that follows the flow's contact section (or consent when none). */
function stepAfterContactSection(config: ContactStepConfig): KYCStep {
  if (config.subjectTypeIsBusiness) return 'business-details';
  const multiRegion = (config.countries?.length ?? 0) > 1;
  return multiRegion ? 'country-select' : 'id-type';
}

/** Where Continue on the consent step goes. */
export function firstStepAfterConsent(config: ContactStepConfig): KYCStep {
  if (hasEmailVerificationStep(config.emailVerification)) return 'email-verification';
  if (hasPhoneVerificationStep(config.phoneVerification)) return 'phone-verification';
  return stepAfterContactSection(config);
}

/** Where Continue on a contact step goes. */
export function stepAfterContact(config: ContactStepConfig, current: 'email-verification' | 'phone-verification'): KYCStep {
  if (current === 'email-verification' && hasPhoneVerificationStep(config.phoneVerification)) {
    return 'phone-verification';
  }
  return stepAfterContactSection(config);
}
