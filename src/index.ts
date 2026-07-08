// Components
export { MyazaKYC, useMyazaKYC } from './MyazaKYC';

// Hosted "continue on your phone" entry — mounted by the Myaza-hosted
// verification page (`/verify/<token>`), not by integrators directly.
export { MyazaKYCHosted } from './MyazaKYCHosted';
export type { MyazaKYCHostedProps } from './MyazaKYCHosted';

// Context (for advanced usage)
export { KYCProvider, useKYCContext } from './context/KYCContext';

// Types
export type {
  MyazaKYCConfig,
  MyazaKYCProps,
  UseMyazaKYCReturn,
  KYCStep,
  KYCAppearance,
  KYCConsentContent,
  KYCSuccessContent,
  VoiceGuidanceConfig,
  VoiceGuidanceOption,
  SupportedCountry,
  AnyCountry,
  IdType,
  AnyIdType,
  QuestionnaireConfig,
  QuestionnaireField,
  QuestionnaireFieldOption,
  QuestionnaireAnswerValue,
} from './types/config';

export type {
  KYCSubmission,
  KYCErrorCode,
  KYCErrorDetails,
} from './types/verification';

// Verification Flow types — the dashboard-built config templates the SDK can
// run from via the `workflowId` prop.
export type { WorkflowConfigPayload, WorkflowResolutionResponse } from './services/api';

// Business (KYB) workflow types — workflow-required; the SDK enters the
// business flow only when the resolved config carries subjectType 'business'.
export type { SubjectType, WorkflowBusinessConfig } from './types/business';

// `KYCError` is a class (extends Error) — export it as a value so consumers can
// `instanceof`-narrow the error passed to onError.
export { KYCError } from './types/verification';
