import type { KYCStep, ProofOfAddressConfig, QuestionnaireConfig } from '../types/config';
import type { SubjectType, WorkflowBusinessConfig } from '../types/business';
import { hasActiveQuestionnaire } from './questionnaire';
import { isBusinessFlow } from './business';

/** Whether the Proof of Address step is part of the flow. */
export function hasProofOfAddressStep(poa: ProofOfAddressConfig | undefined | null): boolean {
  return poa?.enabled === true;
}

/**
 * The step that follows capture/liveness: Proof of Address (when enabled),
 * then the questionnaire (when active), then submission. Call sites map a
 * 'submitted' return to their own submit mechanism (SET_STEP vs
 * SUBMIT_VERIFICATION).
 *
 * In a BUSINESS flow the capture leg is the applicant's own verification, and
 * it is the LAST thing in the application: PoA never runs on KYB, and the
 * questionnaire was already asked back in the company section (before key
 * people). Returning 'questionnaire' here made the reordered flow a loop —
 * questionnaire → key people → applicant capture → questionnaire again.
 */
export function stepAfterCapture(config: {
  proofOfAddress?: ProofOfAddressConfig;
  questionnaire?: QuestionnaireConfig;
  subjectType?: SubjectType;
  business?: WorkflowBusinessConfig;
}): Extract<KYCStep, 'proof-of-address' | 'questionnaire' | 'submitted'> {
  if (isBusinessFlow(config)) return 'submitted';
  if (hasProofOfAddressStep(config.proofOfAddress)) return 'proof-of-address';
  if (hasActiveQuestionnaire(config.questionnaire)) return 'questionnaire';
  return 'submitted';
}
