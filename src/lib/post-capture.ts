import type { KYCStep, ProofOfAddressConfig, QuestionnaireConfig } from '../types/config';
import { hasActiveQuestionnaire } from './questionnaire';

/** Whether the Proof of Address step is part of the flow. */
export function hasProofOfAddressStep(poa: ProofOfAddressConfig | undefined | null): boolean {
  return poa?.enabled === true;
}

/**
 * The step that follows capture/liveness: Proof of Address (when enabled),
 * then the questionnaire (when active), then submission. Call sites map a
 * 'submitted' return to their own submit mechanism (SET_STEP vs
 * SUBMIT_VERIFICATION).
 */
export function stepAfterCapture(config: {
  proofOfAddress?: ProofOfAddressConfig;
  questionnaire?: QuestionnaireConfig;
}): Extract<KYCStep, 'proof-of-address' | 'questionnaire' | 'submitted'> {
  if (hasProofOfAddressStep(config.proofOfAddress)) return 'proof-of-address';
  if (hasActiveQuestionnaire(config.questionnaire)) return 'questionnaire';
  return 'submitted';
}
